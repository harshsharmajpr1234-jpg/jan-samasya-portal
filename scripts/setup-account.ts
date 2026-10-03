/**
 * Canonical account provisioning — CREATE or UPDATE exactly one account.
 *
 *   npx tsx scripts/setup-account.ts
 *
 * All values come from the environment. The password is NEVER printed, logged,
 * written to source, or committed — only its bcrypt hash (with a per-user salt)
 * is stored in the database.
 *
 * Required:
 *   SETUP_ACCOUNT_EMAIL      login email
 *   SETUP_ACCOUNT_PASSWORD   password (min 12 chars, must contain a letter + digit)
 *   SETUP_ACCOUNT_ROLE       "officer" | "admin"   (no silent default)
 *
 * Required depending on role:
 *   SETUP_ACCOUNT_WARD                 12 | 13 | 14   (REQUIRED when role=officer)
 *   SETUP_ACCOUNT_CONFIRM_ALL_WARDS    "true"         (REQUIRED when role=admin,
 *                                                      because admin sees every ward)
 *
 * Optional:
 *   SETUP_ACCOUNT_NAME       display name (default "Ward Officer")
 *
 * Behaviour:
 *   - Upserts on the unique email: an existing account is UPDATED in place,
 *     never duplicated.
 *   - Stores only `password_hash` (bcrypt, 10 rounds, per-user salt).
 *   - Refuses to run when the requested scope is broader than explicitly
 *     confirmed, so nobody is silently granted access to every ward.
 */
import "dotenv/config";
import { db } from "@/db";
import { officers } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { hashPassword } from "@/lib/password";

const SUPPORTED = [12, 13, 14];

function fail(msg: string): never {
  console.error(`setup-account: ${msg}`);
  process.exit(1);
}

async function main() {
  const email = (process.env.SETUP_ACCOUNT_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SETUP_ACCOUNT_PASSWORD ?? "";
  const name = (process.env.SETUP_ACCOUNT_NAME ?? "Ward Officer").trim();
  const roleRaw = (process.env.SETUP_ACCOUNT_ROLE ?? "").trim().toLowerCase();
  const wardRaw = (process.env.SETUP_ACCOUNT_WARD ?? "").trim();
  const confirmAllWards = process.env.SETUP_ACCOUNT_CONFIRM_ALL_WARDS === "true";

  // ---- input validation (password is checked but never echoed) ----
  if (!email) fail("SETUP_ACCOUNT_EMAIL is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("SETUP_ACCOUNT_EMAIL is not a valid email address.");
  if (!password) fail("SETUP_ACCOUNT_PASSWORD is required. It is read from the environment and never printed or logged.");
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    fail("SETUP_ACCOUNT_PASSWORD must be at least 12 characters and contain a letter and a digit.");
  }
  if (roleRaw !== "officer" && roleRaw !== "admin") {
    fail('SETUP_ACCOUNT_ROLE must be explicitly set to "officer" or "admin" (no silent default).');
  }
  const role = roleRaw as "officer" | "admin";

  // ---- least-privilege scope rules ----
  let ward: number | null = null;
  if (role === "officer") {
    const w = Number(wardRaw);
    if (!wardRaw || !SUPPORTED.includes(w)) {
      fail("SETUP_ACCOUNT_WARD must be 12, 13 or 14 for an officer account (officers are ward-scoped).");
    }
    ward = w;
  } else {
    // admin sees EVERY ward in this portal — require explicit confirmation.
    if (!confirmAllWards) {
      fail(
        'role=admin grants access to every ward (12, 13, 14). This is not granted silently. ' +
          'Set SETUP_ACCOUNT_CONFIRM_ALL_WARDS=true to confirm, or set SETUP_ACCOUNT_ROLE=officer with SETUP_ACCOUNT_WARD=<12|13|14> for ward-only access.',
      );
    }
    ward = null;
  }

  // ---- upsert (unique email index guarantees no duplicates) ----
  const [existing] = await db
    .select({ id: officers.id, email: officers.email, role: officers.role, ward: officers.ward })
    .from(officers)
    .where(eq(officers.email, email))
    .limit(1);

  const passwordHash = await hashPassword(password);

  if (existing) {
    await db
      .update(officers)
      .set({ name, passwordHash, role, ward, active: true })
      .where(eq(officers.id, existing.id));
    console.log(`setup-account: UPDATED existing account ${email} (id ${existing.id}) — no duplicate created.`);
  } else {
    const [created] = await db
      .insert(officers)
      .values({ name, email, passwordHash, role, ward, active: true })
      .returning({ id: officers.id });
    console.log(`setup-account: CREATED account ${email} (id ${created.id}).`);
  }

  // ---- verify the stored secret is a hash, never plaintext ----
  const [check] = await db
    .select({ passwordHash: officers.passwordHash })
    .from(officers)
    .where(eq(officers.email, email))
    .limit(1);
  const stored = check?.passwordHash ?? "";
  if (!stored.startsWith("$2")) fail("stored secret is not a bcrypt hash — aborting, please inspect the database.");
  if (stored.includes(password)) fail("plaintext password detected in the stored value — aborting.");

  console.log(`setup-account: name  = ${name}`);
  console.log(`setup-account: role  = ${role}`);
  console.log(`setup-account: ward  = ${ward === null ? "all wards (12, 13, 14)" : `ward ${ward} only`}`);
  console.log("setup-account: password stored as a salted bcrypt hash (never logged).");

  // ---- warn about any other active account that is no longer needed ----
  const others = await db
    .select({ email: officers.email, role: officers.role })
    .from(officers)
    .where(and(ne(officers.email, email), eq(officers.active, true)));
  if (others.length > 0) {
    console.log("\nsetup-account: NOTE — other ACTIVE accounts also exist:");
    for (const o of others) console.log(`   - ${o.email} (${o.role})`);
    console.log("   Review these and disable any that are not required (scripts/disable-account.ts).");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("setup-account: failed:", err);
  process.exit(1);
});
