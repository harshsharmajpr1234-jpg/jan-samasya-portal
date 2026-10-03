/**
 * ONE-TIME production admin bootstrap.
 *
 *   npx tsx scripts/bootstrap-admin.ts
 *
 * Security rules enforced here:
 *   - The password is read from the environment ONLY (BOOTSTRAP_ADMIN_PASSWORD,
 *     falling back to SEED_ADMIN_PASSWORD). It is NEVER hardcoded or printed.
 *   - This is a deliberate, one-time step: it refuses to run if any admin
 *     account already exists, so it cannot be used to silently mint accounts.
 *   - Requires a strong password (>= 12 chars, letter + digit).
 *
 * See docs/DEPLOYMENT.md § "One-time admin setup".
 */
import "dotenv/config";
import { db } from "@/db";
import { officers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/password";

function fail(msg: string): never {
  console.error(`bootstrap-admin: ${msg}`);
  process.exit(1);
}

async function main() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "";
  const name = (process.env.BOOTSTRAP_ADMIN_NAME ?? "Portal Admin").trim();

  if (!email || !password) {
    fail(
      "set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in the environment first. " +
        "The password is read from the environment and is never printed or logged.",
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("BOOTSTRAP_ADMIN_EMAIL is not a valid email address.");
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    fail("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters and contain a letter and a digit.");
  }

  const existingAdmins = await db
    .select({ id: officers.id, email: officers.email })
    .from(officers)
    .where(eq(officers.role, "admin"));
  if (existingAdmins.length > 0) {
    fail(
      `refusing to run: ${existingAdmins.length} admin account(s) already exist. ` +
        "Admin creation is a one-time step; use the existing admin console to add further accounts.",
    );
  }

  const duplicate = await db.select({ id: officers.id }).from(officers).where(eq(officers.email, email)).limit(1);
  if (duplicate.length > 0) {
    fail(`an account with email ${email} already exists with a non-admin role. Choose a different admin email.`);
  }

  await db.insert(officers).values({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: "admin",
    ward: null,
    wardScope: "all",
    active: true,
  });

  console.log(`bootstrap-admin: admin account created for ${email}.`);
  console.log("bootstrap-admin: password was read from the environment and has not been logged.");
  console.log("bootstrap-admin: for safety, unset BOOTSTRAP_ADMIN_PASSWORD from the environment now.");
  process.exit(0);
}

main().catch((err) => {
  console.error("bootstrap-admin: failed:", err);
  process.exit(1);
});
