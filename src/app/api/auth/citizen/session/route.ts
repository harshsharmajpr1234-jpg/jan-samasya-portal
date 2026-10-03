import { getCitizenSession } from "@/lib/auth";
import { handlePreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return handlePreflight(req);
}

export async function GET() {
  const session = await getCitizenSession();
  if (!session) {
    return Response.json({ authenticated: false }, { status: 401 });
  }
  return Response.json({ authenticated: true, citizen: session });
}
