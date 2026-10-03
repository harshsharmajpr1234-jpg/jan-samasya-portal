import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE, type SessionPayload } from "./jwt";

/**
 * Server-side session lookup (route handlers and server components).
 *
 * Verifies the JWT, then re-checks the account so a logout really works:
 * tokens issued at or before `sessionsRevokedAt` are rejected even if they are
 * still cryptographically valid, and disabled accounts are rejected too.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;

  try {
    const { db } = await import("@/db");
    const { officers } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({
        sessionVersion: officers.sessionVersion,
        active: officers.active,
      })
      .from(officers)
      .where(eq(officers.id, payload.sub))
      .limit(1);
    if (!row || !row.active) return null;

    // Exact sign-out check: the token must carry the account's CURRENT session
    // generation. A generation bump at sign-out invalidates every earlier token
    // immediately and with no clock-granularity ambiguity.
    const tokenVersion = payload.sessionVersion ?? 0;
    if (tokenVersion !== row.sessionVersion) return null;
  } catch (err) {
    // Never surface a 500 from the auth probe; fall back to the verified token.
    console.error("session-revocation-check-failed", err);
  }
  return payload;
}

/** Throws-aware helper for API routes: returns session or a 401 Response. */
export async function requireOfficer(): Promise<
  { ok: true; session: SessionPayload } | { ok: false; response: Response }
> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: Response.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

export async function requireAdmin(): Promise<
  { ok: true; session: SessionPayload } | { ok: false; response: Response }
> {
  const res = await requireOfficer();
  if (!res.ok) return res;
  if (res.session.role !== "admin") {
    return {
      ok: false,
      response: Response.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return res;
}

/**
 * Precise session diagnostic.
 *
 * Distinguishes the two very different failures that a naive check conflates:
 *   - the browser never SENT the cookie (blocked/purged cookie, cross-site
 *     embedding, wrong attributes) — a client/transport problem, and
 *   - the cookie WAS sent but the token was rejected — a server-side problem.
 *
 * Reports reason codes only; never a token, cookie value or secret.
 */
export type SessionDiagnostic =
  | { authenticated: true; session: SessionPayload }
  | {
      authenticated: false;
      cookieReceived: boolean;
      reason: "not_configured" | "no_cookie" | "invalid_token" | "account_inactive" | "session_revoked" | "server_error";
    };

export async function getSessionDiagnostic(cookieHeader?: string | null): Promise<SessionDiagnostic> {
  const store = await cookies();
  const token = cookieHeader
    ? parseCookieValue(cookieHeader, SESSION_COOKIE)
    : store.get(SESSION_COOKIE)?.value;

  const cookieReceived = Boolean(token);
  if (!token) return { authenticated: false, cookieReceived: false, reason: "no_cookie" };

  let payload: SessionPayload | null = null;
  try {
    payload = await verifySession(token);
  } catch {
    payload = null;
  }
  if (!payload) return { authenticated: false, cookieReceived: true, reason: "invalid_token" };

  try {
    const { db } = await import("@/db");
    const { officers } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({ sessionVersion: officers.sessionVersion, active: officers.active })
      .from(officers)
      .where(eq(officers.id, payload.sub))
      .limit(1);
    if (!row) return { authenticated: false, cookieReceived: true, reason: "account_inactive" };
    if (!row.active) return { authenticated: false, cookieReceived: true, reason: "account_inactive" };
    if ((payload.sessionVersion ?? 0) !== row.sessionVersion) {
      return { authenticated: false, cookieReceived: true, reason: "session_revoked" };
    }
  } catch {
    return { authenticated: false, cookieReceived: true, reason: "server_error" };
  }

  return { authenticated: true, session: payload };
}

function parseCookieValue(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}
