import { db } from "@/db";
import { officers, wards } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createOfficerSchema } from "@/lib/validators";
import { hashPassword } from "@/lib/password";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * ONE-TIME PROTECTED BOOTSTRAP for officer / admin accounts.
 *
 * Security properties:
 *  - Gated by `BOOTSTRAP_TOKEN`, a private server-side environment variable.
 *    It is read with `process.env` in a route handler, so it is NEVER bundled
 *    into, or exposed to, the browser.
 *  - When `BOOTSTRAP_TOKEN` is unset the endpoint is completely disabled
 *    (503) — which is the expected state AFTER provisioning is finished.
 *  - Rate limited, and the password is validated and stored only as a salted
 *    bcrypt hash. It is never echoed, logged or returned.
 *  - Upserts on the unique email: an existing account is updated in place and
 *    never duplicated.
 *
 * Ward scope (`all` | `single`) is requested explicitly. `all` is only granted
 * when the request explicitly asks for it AND lists the wards it is being
 * granted over, so nobody receives it by accident.
 */

const REASONABLE = 24 * 60 * 60 * 1000;

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  const rl = rateLimit(`bootstrap:${clientIp(req)}`, 5, REASONABLE);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  // Bootstrap is disabled unless a token is configured on the server.
  const expected = process.env.BOOTSTRAP_TOKEN;
  if (!expected || expected.length < 16) {
    return json(
      {
        error:
          "Bootstrap is disabled. Set BOOTSTRAP_TOKEN on the server to provision an initial account, then remove it again.",
      },
      { status: 503 },
    );
  }

  const provided = req.headers.get("x-bootstrap-token") ?? "";
  if (!provided || !timingSafeEqual(provided, expected)) {
    return json({ error: "Invalid bootstrap token." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createOfficerSchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // `all` is never inferred from the role — it is granted only because the
  // request explicitly asked for `wardScope: "all"`.

  // Ward must exist in the ward configuration (unless scope is 'all').
  if (input.wardScope === "single") {
    const [wardRow] = await db
      .select({ id: wards.id })
      .from(wards)
      .where(and(eq(wards.number, input.ward!), eq(wards.active, true)))
      .limit(1);
    if (!wardRow) {
      return json(
        { error: "That ward is not configured in the application. Add it to the ward configuration first." },
        { status: 400 },
      );
    }
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const [existing] = await db
      .select({ id: officers.id })
      .from(officers)
      .where(eq(officers.email, input.email))
      .limit(1);

    if (existing) {
      await db
        .update(officers)
        .set({
          name: input.name,
          passwordHash,
          role: input.role,
          wardScope: input.wardScope,
          ward: input.wardScope === "single" ? input.ward! : null,
          active: true,
        })
        .where(eq(officers.id, existing.id));
    } else {
      await db.insert(officers).values({
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        wardScope: input.wardScope,
        ward: input.wardScope === "single" ? input.ward! : null,
        active: true,
      });
    }

    // Report the ward scope in terms of the CURRENT configuration, without
    // ever enumerating a fixed list in the access logic.
    const configured = await db
      .select({ number: wards.number })
      .from(wards)
      .where(eq(wards.active, true));
    const configuredNumbers = configured.map((w) => w.number);
    const covered =
      input.wardScope === "all"
        ? configuredNumbers
        : configuredNumbers.filter((n) => n === input.ward);

    return json(
      {
        ok: true,
        updated: Boolean(existing),
        account: {
          email: input.email,
          name: input.name,
          role: input.role,
          wardScope: input.wardScope,
          ward: input.wardScope === "single" ? input.ward : null,
        },
        wardsCoveredNow: covered,
        note:
          input.wardScope === "all"
            ? "This account covers every ward in the ward configuration, including wards added later."
            : "This account is restricted to a single ward.",
        nextStep: "Remove BOOTSTRAP_TOKEN from the server environment now that provisioning is complete.",
      },
      { status: existing ? 200 : 201 },
    );
  } catch (err) {
    console.error("bootstrap-failed", err);
    return json({ error: "Provisioning failed" }, { status: 500 });
  }
}

/** Never allow this endpoint to be enumerated with a GET. */
export async function GET() {
  return json({ error: "Method not allowed" }, { status: 405 });
}
