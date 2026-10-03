import { db } from "@/db";
import { citizens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { citizenRegisterSchema } from "@/lib/validators";
import { hashPassword } from "@/lib/password";
import { isJwtSecretConfigured, signCitizenSession } from "@/lib/jwt";
import { buildCitizenSessionCookie } from "@/lib/cookies";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { handlePreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return handlePreflight(req);
}

export async function POST(req: Request) {
  if (!isJwtSecretConfigured()) {
    return Response.json(
      { error: "Registration is temporarily unavailable. Server JWT secret is missing." },
      { status: 503 },
    );
  }

  const ip = clientIp(req);
  const gate = rateLimit(`citizen-register:${ip}`, 5, 10 * 60 * 1000);
  if (!gate.allowed) return rateLimitResponse(gate.retryAfterSec);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = citizenRegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, mobile, email, password } = parsed.data;

  // Check unique mobile
  const [existing] = await db
    .select({ id: citizens.id })
    .from(citizens)
    .where(eq(citizens.mobile, mobile))
    .limit(1);

  if (existing) {
    return Response.json(
      { error: "A citizen account with this mobile number already exists. Please sign in instead." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  try {
    const [created] = await db
      .insert(citizens)
      .values({
        name,
        mobile,
        email: email || null,
        passwordHash,
        active: true,
      })
      .returning();

    const token = await signCitizenSession({
      sub: created.id,
      name: created.name,
      mobile: created.mobile,
      email: created.email || undefined,
      role: "citizen",
      sessionVersion: created.sessionVersion,
    });

    const res = Response.json(
      {
        ok: true,
        citizen: {
          id: created.id,
          name: created.name,
          mobile: created.mobile,
          email: created.email,
        },
      },
      { status: 201 },
    );

    res.headers.append("Set-Cookie", buildCitizenSessionCookie({ req, value: token }));
    return res;
  } catch (err) {
    console.error("citizen-register-error", err);
    return Response.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}
