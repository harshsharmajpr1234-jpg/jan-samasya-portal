/**
 * Disable an account WITHOUT deleting it (non-destructive).
 *
 *   TARGET_ACCOUNT_EMAIL="someone@example.org" npx tsx scripts/disable-account.ts
 *
 * Sets `active = false`, which makes login return 401 immediately. The row and
 * its history are preserved so nothing is lost and the change is reversible:
 *
 *   TARGET_ACCOUNT_EMAIL="..." npx tsx scripts/disable-account.ts --enable
 */
import "dotenv/config";
import { db } from "@/db";
import { officers } from "@/db/schema";
import { eq } from "drizzle-orm";

function fail(msg: string): never {
  console.error(`disable-account: ${msg}`);
  process.exit(1);
}

async function main() {
  const email = (process.env.TARGET_ACCOUNT_EMAIL ?? "").trim().toLowerCase();
  const enable = process.argv.includes("--enable");
  if (!email) fail("set TARGET_ACCOUNT_EMAIL in the environment.");

  const [account] = await db
    .select({ id: officers.id, email: officers.email, role: officers.role, active: officers.active })
    .from(officers)
    .where(eq(officers.email, email))
    .limit(1);
  if (!account) fail(`no account with email ${email}. No changes made.`);

  await db.update(officers).set({ active: enable }).where(eq(officers.id, account.id));

  console.log(`disable-account: ${account.email} (${account.role}) is now ${enable ? "ACTIVE" : "DISABLED"}.`);
  console.log("disable-account: no record was deleted; re-run with --enable to restore access.");
  process.exit(0);
}

main().catch((err) => {
  console.error("disable-account: failed:", err);
  process.exit(1);
});
