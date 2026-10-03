import { db } from "@/db";
import { officers } from "@/db/schema";
import { sql } from "drizzle-orm";
import { loginSchema } from "@/lib/validators";
import { describeHashFormat, isBcryptHash, verifyPassword } from "@/lib/password";
import { isJwtSecretConfigured, signSession } from "@/lib/jwt";
import { buildSessionCookie } from "@/lib/cookies";
import { clientIp, peekLimit, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { handlePreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return handlePreflight(req);
}

/** Always shown to the user — never reveals which of the checks failed. */
const INVALID_MSG = "Invalid email or password.";

/** Per-account throttle. Counted on FAILED attempts only. */
const ACCOUNT_MAX = 10;
const ACCOUNT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Coarse backstop against password spraying across many accounts — applied
 * only when a real client IP could be resolved. Behind a shared CDN edge the
 * IP is unreliable and would otherwise lock out every legitimate user at once.
 */
const IP_MAX = 200;
const IP_WINDOW_MS = 10 * 60 * 1000;

/** Uniform 401 — never reveals whether the account exists. */
function invalid(): Response {
  return Response.json({ error: INVALID_MSG }, { status: 401 });
}

/**
 * Safe, non-reversible email form for server logs: first character + domain.
 * Enough for an operator to recognise their own account, useless to a log
 * scraper, and never the full address.
 */
function redactEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export async function POST(req: Request) {
  // 1) Misconfiguration must fail clearly and safely, never with a stack trace.
  if (!isJwtSecretConfigured()) {
    console.error(
      "login-blocked: reason=jwt_secret_missing — set JWT_SECRET (min 32 chars) or JWT_SECRET_FILE in the host environment.",
    );
    return Response.json(
      {
        error:
          "Sign-in is temporarily unavailable: the server is not configured. Please contact the initiative and mention 'missing JWT secret'.",
        code: "CONFIG_MISSING_JWT_SECRET",
      },
      { status: 503 },
    );
  }

  // 2) Body must parse.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // The form posts exactly { email, password } — see components/officer/LoginForm.tsx.
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    // Same status/message as a wrong password: no enumeration via validation.
    console.warn(
      `login-failed: reason=payload_invalid fields=${Object.keys(parsed.error.flatten().fieldErrors).join(",") || "none"}`,
    );
    return invalid();
  }
  const { email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  // 3) Throttling is scoped to (client IP, account), NOT to the IP alone.
  const ip = clientIp(req);
  const ipResolved = ip !== "unknown";
  const accountKey = `login:${ip}:${normalizedEmail}`;

  const gate = peekLimit(accountKey, ACCOUNT_MAX);
  if (!gate.allowed) {
    console.warn(`login-throttled: account=${redactEmail(normalizedEmail)} window=10m`);
    return rateLimitResponse(gate.retryAfterSec);
  }
  if (ipResolved) {
    const ipGate = peekLimit(`login-ip:${ip}`, IP_MAX);
    if (!ipGate.allowed) return rateLimitResponse(ipGate.retryAfterSec);
  }

  // 4) Case-insensitive lookup — `=` on text is case-sensitive in PostgreSQL.
  let record: typeof officers.$inferSelect | null = null;
  try {
    const [row] = await db
      .select()
      .from(officers)
      .where(sql`lower(${officers.email}) = ${normalizedEmail}`)
      .limit(1);
    record = row ?? null;
  } catch (err) {
    console.error(
      "login-db-error:",
      err instanceof Error ? err.message : "unknown database error",
      "| hint=check DATABASE_URL and that the database is reachable from this host",
    );
    return Response.json(
      { error: "Sign-in is temporarily unavailable. Please try again shortly.", code: "DB_UNAVAILABLE" },
      { status: 503 },
    );
  }

  // 5) Diagnose the failure precisely on the SERVER only.
  //    The browser always receives the same generic 401 below.
  const hashFormat = describeHashFormat(record?.passwordHash);
  let reason = "password_mismatch";
  if (!record) reason = "account_not_found";
  else if (!record.active) reason = "account_inactive";
  else if (!isBcryptHash(record.passwordHash)) reason = "hash_format_unsupported";

  if (reason === "password_mismatch") {
    // Only spend bcrypt time when the row is actually verifiable.
    const ok = await verifyPassword(password, record!.passwordHash);
    if (!ok) {
      rateLimit(accountKey, ACCOUNT_MAX, ACCOUNT_WINDOW_MS);
      if (ipResolved) rateLimit(`login-ip:${ip}`, IP_MAX, IP_WINDOW_MS);
      console.warn(
        `login-failed: reason=password_mismatch account=${redactEmail(normalizedEmail)} hashFormat=${hashFormat} ip=${ipResolved ? "resolved" : "unresolved"}`,
      );
      return invalid();
    }
    reason = "ok";
  } else {
    rateLimit(accountKey, ACCOUNT_MAX, ACCOUNT_WINDOW_MS);
    if (ipResolved) rateLimit(`login-ip:${ip}`, IP_MAX, IP_WINDOW_MS);
    console.warn(
      `login-failed: reason=${reason} account=${redactEmail(normalizedEmail)} hashFormat=${hashFormat} active=${record?.active ?? "n/a"} ip=${ipResolved ? "resolved" : "unresolved"}`,
    );
    return invalid();
  }

  // 6) Issue the session.
  try {
    const token = await signSession({
      sub: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
      ward: record.ward,
      wardScope: record.wardScope,
      sessionVersion: record.sessionVersion,
    });

    const res = Response.json({
      ok: true,
      officer: {
        name: record.name,
        email: record.email,
        role: record.role,
        ward: record.ward,
        wardScope: record.wardScope,
      },
    });

    // Cookie attributes come from the shared policy so that the sign-out
    // deletion later matches this cookie exactly.
    res.headers.append("Set-Cookie", buildSessionCookie({ req, value: token }));
    console.log(`login-ok: account=${redactEmail(normalizedEmail)} role=${record.role} wardScope=${record.wardScope}`);
    return res;
  } catch (err) {
    console.error("login-session-error:", err instanceof Error ? err.message : "unknown session error");
    return Response.json(
      { error: "Sign-in is temporarily unavailable. Please try again shortly.", code: "SESSION_ERROR" },
      { status: 503 },
    );
  }
}
