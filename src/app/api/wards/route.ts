import { getConfiguredWards } from "@/lib/wards";
import { handlePreflight, jsonResponse } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return handlePreflight(req);
}

/** Public: the wards currently configured in the application. */
export async function GET(req: Request) {
  const rows = await getConfiguredWards();
  return jsonResponse(req, {
    wards: rows.map((w) => ({ number: w.number, name: w.name, label: `Ward ${w.number}` })),
  });
}
