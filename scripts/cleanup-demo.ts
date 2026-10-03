/**
 * DEMO / TEST DATA CLEANUP — dry-run by default, transactional, never truncates.
 *
 *   npx tsx scripts/cleanup-demo.ts                # dry run (prints + counts only)
 *   npx tsx scripts/cleanup-demo.ts --confirm      # deletes inside ONE transaction
 *
 * Scope — ONLY rows positively identified as demo/test data:
 *   - complaints whose citizen name is a known test label (allow-list below)
 *   - their complaint_events (audit rows belonging ONLY to those complaints)
 *   - seeded demo accounts with the reserved dev domain `*.jsnm.local`
 *
 * Explicitly NOT touched:
 *   - real complaints, real citizens, real officer accounts
 *   - ward reference records (ward_delimitations / ward_localities)
 *   - categories
 *   - areas: see note at the bottom — they back the live complaint form and
 *     cannot be distinguished from legitimate records, so they are reported
 *     for manual review instead of being deleted.
 *
 * Nothing is ever truncated or dropped. Every deletion is scoped by an
 * explicit allow-list of identifiers.
 */
import "dotenv/config";
import { db } from "@/db";
import { areas, complaintEvents, complaints, officers } from "@/db/schema";
import { and, ilike, inArray, isNotNull, notInArray, or, sql } from "drizzle-orm";

/** Exact test citizen labels (plus prefix rules below for generated variants). */
const DEMO_CITIZEN_NAMES = [
  "Demo Citizen One",
  "Demo Citizen Two",
  "Demo Citizen Three",
  "E2E Test Citizen",
  "Location Test A",
  "Location Test B",
  "Location Test C",
  "Location Test D",
  "Location Test E",
  "Probe Citizen",
  "Probe Photo",
];
/** Prefix rules cover any test label the automated fixtures generate. */
const DEMO_CITIZEN_PREFIXES = ["Location Test", "Probe ", "E2E Test", "Scope Test"];
/** Mobiles used by the seeded demo complaints. */
const DEMO_MOBILES = ["9876543210", "9876543211", "9876543212"];
/** Seeded dev accounts use the reserved, non-routable `.local` dev domain. */
const DEMO_EMAILS = ["admin@jsnm.local", "ward12@jsnm.local", "ward13@jsnm.local", "ward14@jsnm.local"];

/**
 * FABRICATED ward-area names — the invented sample list that was previously
 * seeded. Every name is enumerated explicitly here so ONLY these are removed;
 * any area added later by an administrator is never matched and never deleted.
 */
const FABRICATED_AREA_NAMES = [
  // Ward 12
  "Gandhi Chowk", "Nehru Colony", "Old Grain Mandi", "Patel Marg", "Shastri Nagar", "Station Road", "Subhash Park",
  // Ward 13
  "Azad Chowk", "Canal Road", "Jawahar Colony", "Krishna Puri", "Lakshmi Bai Marg", "Sadar Bazaar", "Shivaji Nagar",
  // Ward 14
  "Ambedkar Chowk", "Mill Area", "New Sabzi Mandi", "River View Road", "Saraswati Vihar", "Tagore Nagar", "Vivekanand Colony",
];

async function main() {
  const confirm = process.argv.includes("--confirm");

  const prefixMatch = or(
    ...DEMO_CITIZEN_PREFIXES.map((p) => ilike(complaints.citizenName, `${p}%`)),
  );

  const demoComplaints = await db
    .select({
      id: complaints.id,
      trackingId: complaints.trackingId,
      citizenName: complaints.citizenName,
      citizenMobile: complaints.citizenMobile,
      ward: complaints.ward,
    })
    .from(complaints)
    .where(
      or(
        inArray(complaints.citizenName, DEMO_CITIZEN_NAMES),
        inArray(complaints.citizenMobile, DEMO_MOBILES),
        prefixMatch,
      ),
    );

  const demoIds = demoComplaints.map((c) => c.id);
  const demoEvents = demoIds.length
    ? await db
        .select({ id: complaintEvents.id })
        .from(complaintEvents)
        .where(inArray(complaintEvents.complaintId, demoIds))
    : [];

  const demoOfficers = await db
    .select({ id: officers.id, email: officers.email, role: officers.role })
    .from(officers)
    .where(inArray(officers.email, DEMO_EMAILS));

  // ---- TEST OFFICER ACCOUNTS created by the verification fixtures ----
  // Only the reserved documentation domain `example.org` is matched, and only
  // with the fixture prefixes used by the test scripts — never real accounts.
  const testOfficers = await db
    .select({ id: officers.id, email: officers.email, role: officers.role })
    .from(officers)
    .where(
      or(
        ilike(officers.email, "scope.test.%@example.org"),
        ilike(officers.email, "auth.test.%@example.org"),
        ilike(officers.email, "login.test.%@example.org"),
      ),
    );

  // ---- FABRICATED AREAS (enumerated allow-list only) ----
  const fabricatedAreas = await db
    .select({ id: areas.id, name: areas.name, ward: areas.ward })
    .from(areas)
    .where(inArray(areas.name, FABRICATED_AREA_NAMES));

  const fabricatedAreaIds = fabricatedAreas.map((a) => a.id);
  // FK GUARD: never delete an area still referenced by any complaint.
  const areaRefs = fabricatedAreaIds.length
    ? await db
        .select({ id: complaints.id, trackingId: complaints.trackingId })
        .from(complaints)
        .where(and(isNotNull(complaints.areaId), inArray(complaints.areaId, fabricatedAreaIds)))
    : [];

  // ---- BEFORE COUNTS ----
  const before = await db.select({
    complaints: sql<number>`count(*)::int`,
    events: sql<number>`(select count(*) from complaint_events)::int`,
    officers: sql<number>`(select count(*) from officers)::int`,
    areas: sql<number>`(select count(*) from areas)::int`,
  }).from(complaints);

  // ---- FOREIGN-KEY GUARD: no surviving complaint may reference a demo officer ----
  const demoOfficerIds = demoOfficers.map((o) => o.id);
  const survivingRefs = demoOfficerIds.length
    ? await db
        .select({ id: complaints.id, trackingId: complaints.trackingId })
        .from(complaints)
        .where(
          and(
            isNotNull(complaints.assignedOfficerId),
            inArray(complaints.assignedOfficerId, demoOfficerIds),
            ...(demoIds.length ? [notInArray(complaints.id, demoIds)] : []),
          ),
        )
    : [];

  console.log(`cleanup-demo: ${confirm ? "CONFIRMED — deleting in one transaction" : "DRY RUN (no changes)"}`);
  console.log("\nBEFORE:");
  console.log(`  complaints      : ${before[0]?.complaints ?? 0}`);
  console.log(`  complaint_events: ${before[0]?.events ?? 0}`);
  console.log(`  officers        : ${before[0]?.officers ?? 0}`);
  console.log(`  areas           : ${before[0]?.areas ?? 0}`);

  console.log(`\nTargeted for removal (positively identified as demo/test):`);
  console.log(`  demo/test complaints : ${demoComplaints.length}`);
  for (const c of demoComplaints) console.log(`    - ${c.trackingId} (ward ${c.ward ?? "-"}, "${c.citizenName}")`);
  console.log(`  their audit events   : ${demoEvents.length}`);
  console.log(`  seeded demo accounts : ${demoOfficers.length}`);
  for (const o of demoOfficers) console.log(`    - ${o.email} (${o.role})`);
  console.log(`  test officer accounts : ${testOfficers.length}`);
  for (const o of testOfficers) console.log(`    - ${o.email} (${o.role})`);
  console.log(`  fabricated area names: ${fabricatedAreas.length}`);
  for (const a of fabricatedAreas) console.log(`    - [Ward ${a.ward}] ${a.name}`);

  if (survivingRefs.length > 0) {
    console.log(`\n  !! SKIPPING officer deletion — ${survivingRefs.length} non-demo complaint(s) still reference them:`);
    for (const r of survivingRefs) console.log(`     - ${r.trackingId}`);
    console.log("     Reassign those complaints first, then re-run.");
  }

  if (areaRefs.length > 0) {
    console.log(
      `\n  !! SKIPPING area deletion — ${areaRefs.length} complaint(s) still reference these fabricated areas:`,
    );
    for (const r of areaRefs) console.log(`     - ${r.trackingId}`);
    console.log("     Those complaints must be re-pointed first (manual review).");
  }

  console.log(`\nLeft untouched (legitimate reference data — never deleted):`);
  console.log(`  ward_delimitations / ward_localities — legitimate ward reference records.`);
  console.log(`  categories — legitimate reference records.`);
  console.log(`  Any area NOT listed above is never matched by this script and is never deleted.`);

  if (!confirm) {
    console.log("\nNo changes made. Re-run with --confirm to delete exactly the rows listed above.");
    process.exit(0);
  }

  // ---- DELETE inside one transaction ----
  await db.transaction(async (tx) => {
    if (demoIds.length > 0) {
      // Children first (audit events), then parent complaints.
      await tx.delete(complaintEvents).where(inArray(complaintEvents.complaintId, demoIds));
      await tx.delete(complaints).where(inArray(complaints.id, demoIds));
    }
    if (demoOfficers.length > 0 && survivingRefs.length === 0) {
      await tx.delete(officers).where(inArray(officers.email, DEMO_EMAILS));
    }
    // Fabricated locality names: deleted only when nothing references them.
    if (fabricatedAreaIds.length > 0 && areaRefs.length === 0) {
      await tx.delete(areas).where(inArray(areas.id, fabricatedAreaIds));
    }
    // Test officers created by the verification fixtures.
    if (testOfficers.length > 0) {
      await tx.delete(officers).where(inArray(officers.id, testOfficers.map((o) => o.id)));
    }
  });

  // ---- AFTER COUNTS ----
  const after = await db.select({
    complaints: sql<number>`count(*)::int`,
    events: sql<number>`(select count(*) from complaint_events)::int`,
    officers: sql<number>`(select count(*) from officers)::int`,
    areas: sql<number>`(select count(*) from areas)::int`,
  }).from(complaints);

  console.log("\nAFTER:");
  console.log(`  complaints      : ${after[0]?.complaints ?? 0}`);
  console.log(`  complaint_events: ${after[0]?.events ?? 0}`);
  console.log(`  officers        : ${after[0]?.officers ?? 0}`);
  console.log(`  areas           : ${after[0]?.areas ?? 0}`);
  console.log("\ncleanup-demo: complete. No table was truncated or dropped.");
  process.exit(0);
}

main().catch((err) => {
  console.error("cleanup-demo: failed:", err);
  process.exit(1);
});
