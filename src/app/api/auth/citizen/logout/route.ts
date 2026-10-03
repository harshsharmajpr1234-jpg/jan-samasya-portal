import { clearCitizenSessionCookie } from "@/lib/cookies";
import { handlePreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return handlePreflight(req);
}

export async function POST(req: Request) {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", clearCitizenSessionCookie(req));
  return res;
}
