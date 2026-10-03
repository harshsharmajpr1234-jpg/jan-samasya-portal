import "dotenv/config";
import { db } from "@/db";
import { officers } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  await db.update(officers).set({ wardScope: "all" }).where(eq(officers.role, "admin"));
  console.log("Admin accounts updated to wardScope = 'all' successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
