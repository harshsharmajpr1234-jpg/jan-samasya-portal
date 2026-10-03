import { db } from "@/db";
import { areas } from "@/db/schema";
import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { createAreaSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** Admin-only: list every area across the supported wards. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const rows = await db.select().from(areas).orderBy(asc(areas.ward), asc(areas.name));
  return Response.json({ areas: rows });
}

/** Admin-only: add an area to Ward 12, 13 or 14 (ward-wise area management). */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = createAreaSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  try {
    const [created] = await db.insert(areas).values(parsed.data).returning();
    return Response.json({ area: created }, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505") {
      return Response.json({ error: "This area already exists in that ward" }, { status: 409 });
    }
    console.error("area-create-failed", err);
    return Response.json({ error: "Could not add the area" }, { status: 500 });
  }
}
