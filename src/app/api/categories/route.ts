import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { handlePreflight, jsonResponse } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return handlePreflight(req);
}

/** Public: list active complaint categories (bilingual). */
export async function GET(req: Request) {
  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      nameEn: categories.nameEn,
      nameHi: categories.nameHi,
      icon: categories.icon,
    })
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.sortOrder));
  return jsonResponse(req, { categories: rows });
}
