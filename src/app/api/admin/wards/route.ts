import { db } from "@/db";
import { wards } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { wardSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/**
 * Ward CONFIGURATION management (admin only).
 *
 * This is the legitimate way to add a ward to the application. Once a ward row
 * exists here it is served by the portal and automatically covered by every
 * account holding the `all wards` scope — no code change, no redeploy.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const rows = await db
    .select({ id: wards.id, number: wards.number, name: wards.name, active: wards.active, createdAt: wards.createdAt })
    .from(wards)
    .orderBy(asc(wards.number));
  return Response.json({ wards: rows });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const body = raw as { number?: unknown; name?: unknown };
  const parsedWard = wardSchema.safeParse(body.number);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!parsedWard.success || name.length < 2 || name.length > 60) {
    return Response.json(
      { error: "Provide a ward number and a name of 2-60 characters" },
      { status: 400 },
    );
  }

  try {
    const [created] = await db
      .insert(wards)
      .values({ number: parsedWard.data, name })
      .returning({ id: wards.id, number: wards.number, name: wards.name, active: wards.active });
    return Response.json(
      {
        ward: created,
        note: "Ward added to the configuration. Accounts with the all-wards scope now cover it automatically.",
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505") {
      return Response.json({ error: "That ward is already configured" }, { status: 409 });
    }
    console.error("ward-create-failed", err);
    return Response.json({ error: "Could not add the ward" }, { status: 500 });
  }
}

/** Never allow ward removal via a DELETE — configuration changes are audited ops. */
export async function DELETE() {
  return Response.json(
    { error: "Ward removal is a manual, audited operation and is not exposed via the API." },
    { status: 405 },
  );
}


