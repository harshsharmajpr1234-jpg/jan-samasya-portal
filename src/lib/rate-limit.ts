/**
 * Simple fixed-window in-memory rate limiter.
 *
 * Zero-cost and dependency-free. One instance per server process — perfect
 * for a single free-tier dyno/instance. If you later scale horizontally,
 * swap this for a free-tier Redis (e.g. Upstash) without changing callers.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Opportunistic cleanup so the map cannot grow unbounded.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Reads the current state WITHOUT incrementing it. Used to reject an already
 * throttled key early, while only successful/failed attempts that actually run
 * are counted by `rateLimit()`.
 */
export function peekLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    return { allowed: true, remaining: limit, retryAfterSec: 0 };
  }
  const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSec,
  };
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
  }

  bucket.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  if (bucket.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  return { allowed: true, remaining: limit - bucket.count, retryAfterSec };
}

/** Best-effort client IP for rate-limit keys (never trust for auth). */
/**
 * Best-effort client IP for rate-limit keys (never trusted for auth).
 *
 * Behind a CDN/serverless proxy (Netlify, Cloudflare, …) `x-forwarded-for` is
 * frequently absent or identical for every visitor. When that happens a naive
 * key collapses ALL users into one rate-limit bucket and, after a handful of
 * attempts, every legitimate user is rejected with 429 — which looks exactly
 * like "login is broken". We therefore prefer the platform's own client-IP
 * header and fall back through the common ones.
 */
const FALLBACK = "unknown";

export function clientIp(req: Request): string {
  const candidates = [
    req.headers.get("x-nf-client-connection-ip"), // Netlify
    req.headers.get("cf-connecting-ip"), // Cloudflare
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for")?.split(",")[0],
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0],
  ];
  for (const c of candidates) {
    const v = c?.trim();
    if (v) return v;
  }
  return FALLBACK;
}

export function rateLimitResponse(retryAfterSec: number): Response {
  return Response.json(
    { error: "Too many requests. Please wait and try again." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}
