import { db } from "@/db";
import { citizens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { citizenLoginSchema } from "@/lib/validators";
import { verifyPassword } from "@/lib/password";
import { isJwtSecretConfigured, signCitizenSession } from "@/lib/jwt";
import { buildCitizenSessionCookie } from "@/lib/cookies";
import { clientIp, peekLimit, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { handlePreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return handlePreflight(req);
}

const INVALID_MSG = "Invalid mobile number or password.";

export async function POST(req: Request) {
  if (!isJwtSecretConfigured()) {
    return Response.json(
      { error: "Sign-in is temporarily unavailable. Server JWT secret is missing." },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = citizenLoginSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: INVALID_MSG }, { status: 401 });
  }
  const { mobile, password } = parsed.data;

  const ip = clientIp(req);
  const accountKey = `citizen-login:${ip}:${mobile}`;

  const gate = peekLimit(accountKey, 10);
  if (!gate.allowed) {
    return rateLimitResponse(gate.retryAfterSec);
  }

  let record: typeof citizens.$inferSelect | null = null;
  try {
    const [row] = await db
      .select()
      .from(citizens)
      .where(eq(citizens.mobile, mobile))
      .limit(1);
    record = row ?? null;
  } catch (err) {
    console.error("citizen-login-db-error", err);
    return Response.json(
      { error: "Sign-in is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  if (!record || !record.active) {
    rateLimit(accountKey, 10, 10 * 60 * 1000);
    return Response.json({ error: INVALID_MSG }, { status: 401 });
  }

  const validPassword = await verifyPassword(password, record.passwordHash);
  if (!validPassword) {
    rateLimit(accountKey, 10, 10 * 60 * 1000);
    return Response.json({ error: INVALID_MSG }, { status: 401 });
  }

  try {
    const token = await signCitizenSession({
      sub: record.id,
      name: record.name,
      mobile: record.mobile,
      email: record.email || undefined,
      role: "citizen",
      sessionVersion: record.sessionVersion,
    });

    const res = Response.json({
      ok: true,
      citizen: {
        id: record.id,
        name: record.name,
        mobile: record.mobile,
        email: record.email,
      },
    });

    res.headers.append("Set-Cookie", buildCitizenSessionCookie({ req, value: token }));
    return res;
  } catch (err) {
    console.error("citizen-session-error", err);
    return Response.json(
      { error: "Sign-in is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
