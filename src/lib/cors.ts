/**
 * Strict CORS handling (zero-cost, server-side only).
 *
 * Default posture: deny cross-origin. An Origin is only reflected when it is
 * listed in the ALLOWED_ORIGINS env var (comma-separated). Because the portal
 * is same-origin, production normally needs no entry at all — set it only if
 * you host a separate frontend. Credentialed officer routes never set CORS
 * headers, so browsers will never send their cookies cross-origin.
 */

export function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return getAllowedOrigins().includes(origin);
}

/** Adds CORS headers to a response only when the origin is allow-listed. */
export function withCors(req: Request, res: Response): Response {
  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin)) return res; // deny by default: no ACAO header
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", origin!);
  // Required for the browser to store/send cookies on a cross-origin request.
  // Without this header the session cookie is silently discarded and sign-in
  // can never persist in an embedded or split-frontend deployment.
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Handles preflight for public routes. Returns 403 for disallowed origins. */
export function handlePreflight(req: Request): Response {
  const origin = req.headers.get("origin");
  if (!origin) return new Response(null, { status: 204 }); // not a CORS request
  if (!isOriginAllowed(origin)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
}

/** JSON response with restrictive CORS applied. */
export function jsonResponse(req: Request, data: unknown, init?: ResponseInit): Response {
  return withCors(req, Response.json(data, init));
}
