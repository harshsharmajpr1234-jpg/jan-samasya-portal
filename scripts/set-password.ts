/**
 * Rotate an existing account's password — NON-DESTRUCTIVE.
 *
 *   BOOTSTRAP_ADMIN_EMAIL="you@example.org" \
 *   NEW_ACCOUNT_PASSWORD="<strong-password>" \
 *   npx tsx scripts/set-password.ts
 *
 * Why this exists: an operator who loses access (or needs to rotate
 * credentials after an environment change) must be able to restore access
 * WITHOUT deleting the account. This script updates exactly one row's
 * password_hash and nothing else — no records are deleted, no tables touched.
 *
 * The password is read from the environment ONLY and is never printed or
 * logged. Requires a strong password (>= 12 chars, letter + digit).
 */
import "dotenv/config";
import { db } from "@/db";
import { officers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/password";

function fail(msg: string): never {
  console.error(`set-password: ${msg}`);
  process.exit(1);
}

async function main() {
  const email = (process.env.TARGET_ACCOUNT_EMAIL ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.NEW_ACCOUNT_PASSWORD ?? "";

  if (!email || !password) {
    fail("set TARGET_ACCOUNT_EMAIL (or BOOTSTRAP_ADMIN_EMAIL) and NEW_ACCOUNT_PASSWORD in the environment. The password is never printed or logged.");
  }
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    fail("NEW_ACCOUNT_PASSWORD must be at least 12 characters and contain a letter and a digit.");
  }

  const [account] = await db
    .select({ id: officers.id, email: officers.email, role: officers.role, active: officers.active })
    .from(officers)
    .where(eq(officers.email, email))
    .limit(1);

  if (!account) {
    fail(`no account exists with email ${email}. No changes made.`);
  }

  await db.update(officers).set({ passwordHash: await hashPassword(password) }).where(eq(officers.id, account.id));

  console.log(`set-password: password rotated for ${account.email} (${account.role}).`);
  console.log("set-password: the new password was read from the environment and has not been logged.");
  console.log("set-password: for safety, unset NEW_ACCOUNT_PASSWORD from the environment now.");
  process.exit(0);
}

main().catch((err) => {
  console.error("set-password: failed:", err);
  process.exit(1);
});
