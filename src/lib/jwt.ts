import { SignJWT, jwtVerify } from "jose";
import { requireJwtSecret } from "./secret";

/**
 * Officer sessions are stateless JWTs stored in an httpOnly cookie.
 * The secret lives ONLY on the server (JWT_SECRET env var).
 */
export interface SessionPayload {
  sub: string; // officer id
  name: string;
  email: string;
  role: "admin" | "officer";
  ward: number | null;
  /** Explicit all-wards permission. 'all' covers every configured ward. */
  wardScope: "all" | "single";
  /**
   * Session generation at issue time. Compared against the account's current
   * value so sign-out is exact, regardless of clock granularity.
   */
  sessionVersion?: number;
  /** Issue time in ms (present on VERIFIED tokens) — checked against logout revocation. */
  iatMs?: number;
}

export const SESSION_COOKIE = "jsnm_session";
export const SESSION_MAX_AGE_SEC = 8 * 60 * 60; // 8 hours

/**
 * Non-throwing config probe so callers can degrade gracefully instead of
 * surfacing an opaque 500 when the deployment forgot to set JWT_SECRET.
 */
export { isJwtSecretConfigured } from "./secret";

function getSecret(): Uint8Array {
  return requireJwtSecret();
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, sessionVersion: payload.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer("jsnm")
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: "jsnm" });
    if (payload.role !== "admin" && payload.role !== "officer") return null;
    return {
      sub: String(payload.sub),
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role === "admin" ? "admin" : "officer",
      ward: typeof payload.ward === "number" ? payload.ward : null,
      wardScope: payload.wardScope === "all" ? "all" : "single",
      sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0,
      iatMs: (typeof payload.iat === "number" ? payload.iat : Math.floor(Date.now() / 1000)) * 1000,
    };
  } catch {
    return null;
  }
}

export interface CitizenSessionPayload {
  sub: string; // citizen id
  name: string;
  mobile: string;
  email?: string;
  role: "citizen";
  sessionVersion?: number;
  iatMs?: number;
}

export const CITIZEN_SESSION_COOKIE = "jsnm_citizen_session";

export async function signCitizenSession(payload: CitizenSessionPayload): Promise<string> {
  return new SignJWT({ ...payload, sessionVersion: payload.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer("jsnm")
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSecret());
}

export async function verifyCitizenSession(token: string): Promise<CitizenSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: "jsnm" });
    if (payload.role !== "citizen") return null;
    return {
      sub: String(payload.sub),
      name: String(payload.name),
      mobile: String(payload.mobile),
      email: typeof payload.email === "string" ? payload.email : undefined,
      role: "citizen",
      sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0,
      iatMs: (typeof payload.iat === "number" ? payload.iat : Math.floor(Date.now() / 1000)) * 1000,
    };
  } catch {
    return null;
  }
}
