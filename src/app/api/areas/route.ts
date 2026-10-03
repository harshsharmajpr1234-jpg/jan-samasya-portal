import { db } from "@/db";
import { areas } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { wardSchema } from "@/lib/validators";
import { handlePreflight, jsonResponse } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return handlePreflight(req);
}

/** Public: list active areas for a supported ward (12, 13 or 14). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = wardSchema.safeParse(searchParams.get("ward"));
  if (!parsed.success) {
    return jsonResponse(req, { error: "Provide a valid ward: 12, 13 or 14" }, { status: 400 });
  }
  const rows = await db
    .select({ id: areas.id, name: areas.name, ward: areas.ward })
    .from(areas)
    .where(and(eq(areas.ward, parsed.data), eq(areas.active, true)))
    .orderBy(asc(areas.name));
  return jsonResponse(req, { areas: rows });
}
