import { SESSION_COOKIE, CITIZEN_SESSION_COOKIE, SESSION_MAX_AGE_SEC } from "./jwt";

/**
 * Single source of truth for the session cookie.
 *
 * Both the login (set) and logout (clear) routes MUST use identical attributes,
 * otherwise the browser treats them as different cookies and the sign-out
 * deletion silently fails — leaving the session alive.
 *
 * Policy:
 *   Name     host-only, `jsnm_session` (no Domain attribute — the verified
 *            architecture is single-origin, so a host-only cookie is correct
 *            and avoids the classic wrong-Domain bug)
 *   Path     /
 *   HttpOnly never readable from JavaScript (no localStorage, no XSS theft)
 *   SameSite Lax for same-origin deployments
 *            None only when a cross-origin frontend is explicitly allow-listed
 *            via ALLOWED_ORIGINS — and None legally requires Secure
 *   Secure   whenever the request is HTTPS, or whenever SameSite=None forces it
 *   Max-Age  SESSION_MAX_AGE_SEC
 */

/** True when the deployment allow-lists a separate (cross-site) frontend origin. */
export function isCrossOriginMode(): boolean {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .length > 0;
}

/** True when this request actually arrived over HTTPS (directly or via proxy). */
export function isHttpsRequest(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto === "https" || req.headers.get("x-forwarded-ssl") === "on" || req.headers.get("origin")?.startsWith("https://") === true;
}

/**
 * True when the app is being used from ANOTHER site — i.e. inside an iframe
 * whose top-level site differs, or from a separately hosted frontend.
 *
 * This is the decisive signal for cookie behaviour: `SameSite=Lax` cookies are
 * NEVER returned on a cross-site request, so an embedded preview would set a
 * session cookie it could never send back.
 */
export function isCrossSiteRequest(req: Request): boolean {
  if (isCrossOriginMode()) return true;

  // Fetch Metadata is authoritative in modern browsers.
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") return true;
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") return false;

  // Fallback: compare the Origin host with the host we are serving.
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host) {
    try {
      return new URL(origin).host !== host;
    } catch {
      return false;
    }
  }
  return false;
}

export interface CookieOptions {
  req: Request;
  /** Value to store. Empty string clears the cookie. */
  value: string;
  /** 0 clears the cookie. */
  maxAgeSec?: number;
}

/** Builds a Set-Cookie header value with the canonical session attributes. */
export function buildSessionCookie({ req, value, maxAgeSec }: CookieOptions): string {
  const crossSite = isCrossSiteRequest(req);

  // SameSite=None is only valid together with Secure; browsers drop it otherwise.
  // A cross-site (embedded) context requires None, so force Secure there.
  const secure = crossSite || isHttpsRequest(req);
  const sameSite = crossSite ? "None" : "Lax";

  const parts = [
    `${SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite}`,
    `Max-Age=${maxAgeSec ?? SESSION_MAX_AGE_SEC}`,
  ];
  if (secure) parts.push("Secure");
  // CHIPS: lets the cookie survive in an embedded context even where the
  // browser blocks unpartitioned third-party cookies. Ignored harmlessly by
  // browsers that do not implement it (they still get SameSite=None; Secure).
  if (crossSite) parts.push("Partitioned");
  return parts.join("; ");
}

/** Clears the session cookie — attribute-for-attribute identical to the setter. */
export function clearSessionCookie(req: Request): string {
  return buildSessionCookie({ req, value: "", maxAgeSec: 0 });
}

export function buildCitizenSessionCookie({ req, value, maxAgeSec }: CookieOptions): string {
  const crossSite = isCrossSiteRequest(req);
  const secure = crossSite || isHttpsRequest(req);
  const sameSite = crossSite ? "None" : "Lax";

  const parts = [
    `${CITIZEN_SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite}`,
    `Max-Age=${maxAgeSec ?? SESSION_MAX_AGE_SEC}`,
  ];
  if (secure) parts.push("Secure");
  if (crossSite) parts.push("Partitioned");
  return parts.join("; ");
}

export function clearCitizenSessionCookie(req: Request): string {
  return buildCitizenSessionCookie({ req, value: "", maxAgeSec: 0 });
}

export { SESSION_COOKIE, CITIZEN_SESSION_COOKIE };
