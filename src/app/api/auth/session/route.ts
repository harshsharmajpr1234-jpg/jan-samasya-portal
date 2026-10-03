import { getSessionDiagnostic } from "@/lib/auth";
import { handlePreflight, jsonResponse } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return handlePreflight(req);
}

/**
 * Reports whether the browser is actually sending the session cookie and
 * whether that cookie verifies — as two separate facts.
 *
 * This exists so the login page can tell "your browser is not storing/sending
 * cookies" apart from "the server rejected the token", instead of guessing.
 * It returns reason codes only and never echoes a cookie value or token.
 */
export async function GET(req: Request) {
  let diag;
  try {
    diag = await getSessionDiagnostic(req.headers.get("cookie"));
  } catch {
    return jsonResponse(req, { authenticated: false, cookieReceived: false, reason: "server_error" }, { status: 200 });
  }

  if (diag.authenticated) {
    return jsonResponse(req, {
      authenticated: true,
      cookieReceived: true,
      reason: "ok",
      officer: {
        name: diag.session.name,
        email: diag.session.email,
        role: diag.session.role,
        ward: diag.session.ward,
        wardScope: diag.session.wardScope,
      },
    });
  }

  return jsonResponse(req, {
    authenticated: false,
    cookieReceived: diag.cookieReceived,
    reason: diag.reason,
  });
}
