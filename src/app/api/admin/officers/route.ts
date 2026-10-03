import { db } from "@/db";
import { officers } from "@/db/schema";
import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { createOfficerSchema } from "@/lib/validators";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

/** Admin-only: list officer accounts (password hashes are never returned). */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const rows = await db
    .select({
      id: officers.id,
      name: officers.name,
      email: officers.email,
      role: officers.role,
      ward: officers.ward,
      active: officers.active,
      createdAt: officers.createdAt,
    })
    .from(officers)
    .orderBy(asc(officers.ward), asc(officers.name));
  return Response.json({ officers: rows });
}

/** Admin-only: create an officer/admin account with a bcrypt-hashed password. */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = createOfficerSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const passwordHash = await hashPassword(input.password);
  try {
    const [created] = await db
      .insert(officers)
      .values({
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        ward: input.role === "officer" ? input.ward! : (input.ward ?? null),
      })
      .returning({ id: officers.id, name: officers.name, email: officers.email, role: officers.role, ward: officers.ward });
    return Response.json({ officer: created }, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505") {
      return Response.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    console.error("officer-create-failed", err);
    return Response.json({ error: "Could not create the account" }, { status: 500 });
  }
}
