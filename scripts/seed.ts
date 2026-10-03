/**
 * Database seed for Jan Samasya Nivaran Manch — PRODUCTION-SAFE.
 *
 *   npx tsx scripts/seed.ts
 *
 * What this script does:
 *   1. ALWAYS: reference/operational lookups — ward delimitation provenance,
 *      categories, and the provisional operational area list.
 *   2. NEVER IN PRODUCTION: demo complaints and default demo accounts. These
 *      are created only when BOTH are true:
 *        - NODE_ENV is NOT 'production'
 *        - SEED_DEMO_DATA=true
 *
 * Secrets policy:
 *   - No password is ever hardcoded, printed or logged.
 *   - Account passwords are read from environment variables only. If they are
 *     absent, account creation is skipped with a message telling you which
 *     variable to set.
 *
 * Real production admin accounts are a one-time, deliberate step:
 *   see `scripts/bootstrap-admin.ts` and docs/DEPLOYMENT.md § "One-time admin".
 */
import "dotenv/config";
import { db } from "@/db";
import {
  categories,
  complaintEvents,
  complaints,
  officers,
  wardDelimitations,
  wards,
} from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { generateUniqueTrackingId } from "@/lib/tracking";

/**
 * INITIAL ward configuration.
 *
 * This is application CONFIGURATION (which wards the portal serves), not
 * locality data. It seeds the `wards` table so the portal has a starting
 * scope. Wards added later go straight into the `wards` table (admin console
 * or an ops script) and are picked up everywhere — including the scope of any
 * account holding the `all wards` permission — with NO code change.
 */
const INITIAL_WARDS: Array<[number, string]> = [
  [12, "Ward 12"],
  [13, "Ward 13"],
  [14, "Ward 14"],
];

const IS_PRODUCTION = process.env.NODE_ENV === "production";
/** True on common hosted platforms, where NODE_ENV could be misconfigured. */
const IS_HOSTED = Boolean(
  process.env.RENDER || process.env.VERCEL || process.env.NETLIFY || process.env.FLY_APP_NAME || process.env.CF_PAGES,
);
/**
 * Demo data requires an explicit opt-in AND a genuinely local, non-production
 * environment. Production and any hosted platform can NEVER automatically
 * create demo complaints, demo users, or default-password accounts.
 */
const ALLOW_DEMO = process.env.SEED_DEMO_DATA === "true" && !IS_PRODUCTION && !IS_HOSTED;

/** Passwords that have ever been shipped or are obvious — never accepted. */
const FORBIDDEN_PASSWORDS = new Set(
  ["Admin@JSNM123", "Officer@JSNM123", "password", "Password1", "changeme", "12345678", "jsnm1234"].map((p) =>
    p.toLowerCase(),
  ),
);

/** Refuses weak or previously-shipped passwords when creating dev accounts. */
function isAcceptablePassword(pw: string): boolean {
  if (pw.length < 12) return false;
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return false;
  return !FORBIDDEN_PASSWORDS.has(pw.toLowerCase());
}

/* ------------------------------------------------------------------ */
/* Ward reference data: provenance only.                               */
/*                                                                     */
/* RULE: we never invent locality names and never assert boundaries we  */
/* cannot confirm. Locality lists come from `import-ward-localities`    */
/* against a documented source; until then the mappings stay           */
/* 'needs_verification'.                                               */
/* ------------------------------------------------------------------ */
async function seedWardDelimitations() {
  await db
    .insert(wardDelimitations)
    .values([
      {
        code: "2024-swachhtam",
        title: "2024 ward dataset — Swachhtam Portal",
        publisher: "Rajasthan Local Self Government Department",
        source: "Swachhtam Portal PDF (2024)",
        delimitation: "2024 delimitation (Swachhtam Portal dataset)",
        delimitationYear: 2024,
        // Source is documented, but our ward 12/13/14 locality mappings have
        // not been transcribed and checked against it yet.
        verificationStatus: "needs_verification",
        verifiedOn: null,
        isCurrent: false,
        notes:
          "Scope limit: this source documents the 2024 dataset ONLY. It is not evidence of the current 2025 merged-JMC ward boundaries.",
      },
      {
        code: "2025-merged-jmc",
        title: "2025 merged-JMC boundaries (current)",
        publisher: "Not confirmed",
        source: "No confirmed source on file",
        delimitation: "2025 merged-JMC ward delimitation",
        delimitationYear: 2025,
        verificationStatus: "needs_verification",
        verifiedOn: null,
        isCurrent: true,
        notes:
          "Could not be confirmed from available sources. Marked 'Needs verification' rather than guessed. The 2024 Swachhtam dataset must not be used as proof of these boundaries.",
      },
    ])
    .onConflictDoNothing();
  console.log("ward delimitations: ok (both marked needs_verification)");
}

/**
 * Provisional operational area list used by the complaint form so the form
 * keeps working. These are PLACEHOLDERS — not taken from a published source —
 * and are explicitly labelled 'needs_verification'. Existing rows are never
 * overwritten (onConflictDoNothing).
 */
async function seedWards() {
  for (const [number, name] of INITIAL_WARDS) {
    await db.insert(wards).values({ number, name }).onConflictDoNothing();
  }
  console.log("ward configuration: ok (wards table is the source of truth)");
}

/**
 * FABRICATED AREA NAMES HAVE BEEN REMOVED.
 *
 * This script deliberately seeds NO ward-area/locality names. The earlier
 * placeholder list (Shastri Nagar, Gandhi Chowk, …) was invented sample data,
 * not taken from a published source, and must never be recreated. Citizens
 * type their own colony / road / landmark instead ("Citizen-provided
 * location").
 *
 * If a verified area list is ever obtained from an authoritative source,
 * import it explicitly with `scripts/import-ward-localities.ts`.
 */
async function seedAreas(): Promise<void> {
  console.log("areas: skipped (no fabricated locality names are ever seeded)");
}

const CATEGORY_LIST: Array<[string, string, string, string, number]> = [
  ["garbage-sanitation", "Garbage & Sanitation", "कचरा एवं सफ़ाई", "trash-2", 1],
  ["water-supply", "Drinking Water Supply", "पेयजल आपूर्ति", "droplets", 2],
  ["roads-potholes", "Roads & Potholes", "सड़क एवं गड्ढे", "construction", 3],
  ["streetlights", "Streetlights", "स्ट्रीट लाइट", "lightbulb", 4],
  ["drainage-sewage", "Drainage & Sewage", "नाली एवं सीवर", "waves", 5],
  ["stray-animals", "Stray Animals", "आवारा पशु", "dog", 6],
  ["encroachment", "Encroachment", "अतिक्रमण", "fence", 7],
  ["parks-public-spaces", "Parks & Public Spaces", "पार्क एवं सार्वजनिक स्थान", "trees", 8],
  ["other", "Other", "अन्य", "circle-dot", 9],
];

async function seedCategories() {
  for (const [slug, nameEn, nameHi, icon, sortOrder] of CATEGORY_LIST) {
    await db.insert(categories).values({ slug, nameEn, nameHi, icon, sortOrder }).onConflictDoNothing();
  }
  console.log("categories: ok");
}

/* ------------------------------------------------------------------ */
/* DEV-ONLY demo accounts. Never runs in production.                    */
/* ------------------------------------------------------------------ */
async function seedDemoOfficers() {
  if (!ALLOW_DEMO) {
    console.log("demo accounts: skipped (dev-only; requires SEED_DEMO_DATA=true and non-production)");
    return;
  }
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const officerEmails = [
    process.env.SEED_WARD12_EMAIL ?? "ward12@jsnm.local",
    process.env.SEED_WARD13_EMAIL ?? "ward13@jsnm.local",
    process.env.SEED_WARD14_EMAIL ?? "ward14@jsnm.local",
  ];
  const officerPassword = process.env.SEED_OFFICER_PASSWORD;

  if (adminEmail && adminPassword && isAcceptablePassword(adminPassword)) {
    await db
      .insert(officers)
      .values({
        name: "Dev Admin",
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        role: "admin",
        ward: null,
      })
      .onConflictDoNothing();
    console.log(`demo admin account: ok (${adminEmail} — password read from environment, not logged)`);
  } else if (adminEmail && adminPassword) {
    console.log(
      "demo admin account: REJECTED — the supplied password is a known default or too weak (min 12 chars, letter + digit). No account created.",
    );
  } else {
    console.log("demo admin account: skipped (set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD; password is never logged)");
  }

  if (officerPassword && isAcceptablePassword(officerPassword)) {
    const wards = [12, 13, 14] as const;
    for (let i = 0; i < wards.length; i++) {
      await db
        .insert(officers)
        .values({
          name: `Ward ${wards[i]} Officer`,
          email: officerEmails[i]!.toLowerCase(),
          passwordHash: await hashPassword(officerPassword),
          role: "officer",
          ward: wards[i],
        })
        .onConflictDoNothing();
    }
    console.log("demo ward officer accounts: ok (password read from environment, not logged)");
  } else if (officerPassword) {
    console.log(
      "demo ward officer accounts: REJECTED — the supplied password is a known default or too weak (min 12 chars, letter + digit). No accounts created.",
    );
  } else {
    console.log("demo ward officer accounts: skipped (set SEED_OFFICER_PASSWORD; password is never logged)");
  }
}

/* ------------------------------------------------------------------ */
/* DEV-ONLY demo complaints. Never runs in production.                  */
/* ------------------------------------------------------------------ */
async function seedDemoComplaints() {
  if (!ALLOW_DEMO) {
    console.log("demo complaints: skipped (dev-only; requires SEED_DEMO_DATA=true and non-production)");
    return;
  }
  const existing = await db.select({ id: complaints.id }).from(complaints).limit(1);
  if (existing.length > 0) {
    console.log("demo complaints: skipped (complaints already exist — nothing is overwritten)");
    return;
  }

  const allCats = await db.select().from(categories);
  const officerRows = await db.select().from(officers);
  const cat = (slug: string) => allCats.find((c) => c.slug === slug)!;
  const officerOf = (ward: number) => officerRows.find((o) => o.ward === ward && o.role === "officer");

  const demos: Array<{
    ward: number; mobile: string; name: string; slug: string; desc: string;
    status: "pending" | "in_progress" | "resolved"; lat: number; lng: number; address: string;
  }> = [
    {
      ward: 12, mobile: "9876543210", name: "Demo Citizen One", slug: "garbage-sanitation",
      desc: "Garbage has not been collected for five days near the community dustbin; stray animals are scattering waste onto the road.",
      status: "pending", lat: 26.85221, lng: 80.94231, address: "Community dustbin, main lane",
    },
    {
      ward: 13, mobile: "9876543211", name: "Demo Citizen Two", slug: "streetlights",
      desc: "Three consecutive streetlights are not working since last week; the stretch becomes completely dark after 7 pm and feels unsafe.",
      status: "in_progress", lat: 26.84712, lng: 80.95102, address: "Lane behind the primary school",
    },
    {
      ward: 14, mobile: "9876543212", name: "Demo Citizen Three", slug: "drainage-sewage",
      desc: "Open drain is overflowing onto the footpath after every rain; water enters the ground-floor shops.",
      status: "resolved", lat: 26.85571, lng: 80.93992, address: "Market road, shop line",
    },
  ];

  for (const d of demos) {
    const trackingId = await generateUniqueTrackingId(d.ward);
    const [row] = await db
      .insert(complaints)
      .values({
        trackingId,
        citizenName: d.name,
        citizenMobile: d.mobile,
        ward: d.ward,
        areaId: null,
        categoryId: cat(d.slug).id,
        description: d.desc,
        // Dev fixtures use the same citizen-typed location field as real users.
        manualLocationText: d.address,
        locationMethod: "gps_and_manual",
        lat: String(d.lat),
        lng: String(d.lng),
        status: d.status,
        assignedOfficerId: d.status === "pending" ? null : (officerOf(d.ward)?.id ?? null),
        resolvedAt: d.status === "resolved" ? new Date() : null,
      })
      .returning();
    await db.insert(complaintEvents).values([
      {
        complaintId: row.id,
        type: "created",
        actorLabel: "Citizen",
        toStatus: "pending",
        remark: `Complaint registered under ${cat(d.slug).nameEn} (Citizen-provided location: ${d.address}, Ward ${d.ward})`,
      },
      ...(d.status !== "pending"
        ? [{
            complaintId: row.id,
            type: "status_changed" as const,
            actorLabel: "Officer: demo",
            fromStatus: "pending",
            toStatus: "in_progress" as const,
            remark: "Field team assigned for inspection (demo data).",
          }]
        : []),
      ...(d.status === "resolved"
        ? [{
            complaintId: row.id,
            type: "status_changed" as const,
            actorLabel: "Officer: demo",
            fromStatus: "in_progress" as const,
            toStatus: "resolved" as const,
            remark: "Drain de-silted and cover repaired (demo data).",
          }]
        : []),
    ]);
    console.log(`  demo complaint ${trackingId} (Ward ${d.ward})`);
  }
}

async function main() {
  console.log(`seed starting — NODE_ENV=${process.env.NODE_ENV ?? "development"}, demo data ${ALLOW_DEMO ? "ENABLED (dev)" : "disabled"}`);
  await seedWards();
  await seedWardDelimitations();
  await seedAreas();
  await seedCategories();
  await seedDemoOfficers();
  await seedDemoComplaints();
  console.log("seed complete");
  process.exit(0);
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
