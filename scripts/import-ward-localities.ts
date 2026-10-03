/**
 * Import ward/locality mappings for the WARD REFERENCE dataset from a CSV that
 * an operator has transcribed from a documented source. We NEVER invent
 * locality names here — every row must come from the file you supply.
 *
 *   npx tsx scripts/import-ward-localities.ts --delimitation=2024-swachhtam \
 *        --csv=./localities-2024.csv [--source-ref="p.14"] [--mark-verified]
 *
 * CSV format (header required):
 *   ward,locality_name[,source_ref]
 *   12,Shastri Nagar,p.14
 *
 * Flags:
 *   --delimitation=<code>  (required) which ward_delimitations row this belongs to
 *   --csv=<path>           (required) input CSV
 *   --source-ref=<text>    default source reference for rows lacking one
 *   --mark-verified        mark rows 'verified' (only valid when the source
 *                          delimitation is documented — never use this for the
 *                          2025 merged-JMC boundaries, which are unconfirmed)
 *
 * Safety: inserts are onConflictDoNothing — existing rows are NEVER overwritten.
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { db } from "@/db";
import { wardDelimitations, wardLocalities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isWardConfigured } from "@/lib/wards";

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

async function main() {
  const code = arg("delimitation");
  const csvPath = arg("csv");
  const defaultRef = arg("source-ref");
  const markVerified = process.argv.includes("--mark-verified");

  if (!code || !csvPath) {
    console.error("usage: npx tsx scripts/import-ward-localities.ts --delimitation=<code> --csv=<path> [--source-ref=<text>] [--mark-verified]");
    process.exit(1);
  }

  const [delim] = await db.select().from(wardDelimitations).where(eq(wardDelimitations.code, code)).limit(1);
  if (!delim) {
    console.error(`unknown delimitation code '${code}'. Seed ward delimitations first (npx tsx scripts/seed.ts).`);
    process.exit(1);
  }

  // Guard: never mark the unconfirmed current boundaries as verified.
  if (markVerified && delim.verificationStatus === "needs_verification") {
    console.error(
      `refusing --mark-verified: delimitation '${code}' is '${delim.verificationStatus}'. ` +
        "Mark unconfirmed boundaries 'needs_verification' rather than guessing.",
    );
    process.exit(1);
  }

  const lines = readFileSync(csvPath, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    console.error("CSV appears empty (need a header row plus at least one data row).");
    process.exit(1);
  }
  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const wardIdx = header.indexOf("ward");
  const nameIdx = header.indexOf("locality_name");
  const refIdx = header.indexOf("source_ref");
  if (wardIdx === -1 || nameIdx === -1) {
    console.error("CSV header must contain: ward,locality_name[,source_ref]");
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim());
    const ward = Number(cols[wardIdx]);
    const localityName = (cols[nameIdx] ?? "").trim();
    const sourceRef = (refIdx !== -1 ? cols[refIdx] : "")?.trim() || defaultRef || null;

    if (!localityName || !(await isWardConfigured(ward))) {
      skipped++;
      continue;
    }
    const rows = await db
      .insert(wardLocalities)
      .values({
        delimitationId: delim.id,
        ward,
        localityName,
        verificationStatus: markVerified ? "verified" : "needs_verification",
        verifiedOn: markVerified ? new Date() : null,
        sourceRef,
      })
      .onConflictDoNothing();
    inserted += rows.rowCount ?? 0;
    if (!(rows.rowCount ?? 0)) skipped++;
  }

  console.log(`import complete for '${code}' (${delim.delimitation}, ${delim.delimitationYear}):`);
  console.log(`  inserted: ${inserted}`);
  console.log(`  skipped (duplicates / invalid ward or name): ${skipped}`);
  console.log(`  status: ${markVerified ? "verified" : "needs_verification"} (source: ${delim.source})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("import failed:", err);
  process.exit(1);
});
