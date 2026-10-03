import {
  pgTable,
  uuid,
  text,
  smallint,
  boolean,
  timestamp,
  numeric,
  varchar,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Jan Samasya Nivaran Manch — persistence schema.
 *
 * The portal serves ONLY Ward 12, Ward 13 and Ward 14. The ward list is a
 * fixed constant in `src/lib/constants.ts` (smallint here), while ward-wise
 * areas live in this table so they can be managed per ward.
 */

/**
 * OPERATIONAL area list used by the complaint form. It is deliberately kept
 * separate from the ward *reference* dataset below (`ward_localities`): this
 * table is citizen/ward-office data, the reference layer is published source
 * data with provenance. Rows here are never overwritten by reference imports.
 */
/**
 * LEGITIMATE WARD CONFIGURATION.
 *
 * This table — not a hardcoded constant — defines which wards the portal
 * serves. Adding a ward here (via the admin console or a seed/ops script) is
 * all that is required for it to be served, selectable and covered by any
 * account holding the `all wards` scope. No code change is needed.
 */
export const wards = pgTable(
  "wards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    number: smallint("number").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wards_number_uq").on(t.number)],
);

export const areas = pgTable(
  "areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ward: smallint("ward").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    /**
     * Verification state of THIS area against a published delimitation.
     * Defaults to 'needs_verification' — we never assert a boundary we have
     * not confirmed. Nullable-safe addition: existing rows are left as-is.
     */
    verificationStatus: text("verification_status", {
      enum: ["verified", "needs_verification", "unverified"],
    })
      .notNull()
      .default("needs_verification"),
    verificationNote: text("verification_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("areas_ward_name_uq").on(t.ward, t.name), index("areas_ward_idx").on(t.ward)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    nameEn: text("name_en").notNull(),
    nameHi: text("name_hi").notNull(),
    icon: text("icon").notNull().default("circle-dot"),
    active: boolean("active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug)],
);

export const officers = pgTable(
  "officers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** 'admin' manages officers/areas/assignment; 'officer' handles complaints. */
    role: text("role", { enum: ["admin", "officer"] }).notNull().default("officer"),
    ward: smallint("ward"),
    /**
     * EXPLICIT all-wards permission, granted per account and never implied by
     * role. 'all' covers every ward in `wards` — including wards added later —
     * without enumerating them. 'single' restricts the account to `ward`.
     */
    wardScope: text("ward_scope", { enum: ["all", "single"] }).notNull().default("single"),
    active: boolean("active").notNull().default(true),
    /**
     * Server-side logout support. Signing out sets this timestamp and any
     * session token issued at or before it is rejected, so a logout really
     * invalidates the JWT instead of only clearing the cookie.
     */
    /**
     * Monotonic session generation, incremented on every sign-out.
     *
     * This is the AUTHORITATIVE logout check. A timestamp comparison against
     * the JWT `iat` (second resolution) cannot distinguish a token issued just
     * before a logout from one issued just after it when both fall in the same
     * second. A version counter is exact in both directions.
     */
    sessionVersion: integer("session_version").notNull().default(0),
    /** Informational: when the most recent sign-out happened. */
    sessionsRevokedAt: timestamp("sessions_revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("officers_email_uq").on(t.email)],
);

export const complaints = pgTable(
  "complaints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Human-friendly unique ID shown to citizens, e.g. JSNM-12-KF4Q7X */
    trackingId: varchar("tracking_id", { length: 24 }).notNull(),
    citizenName: text("citizen_name").notNull(),
    citizenMobile: varchar("citizen_mobile", { length: 10 }).notNull(),
    /** Ward 12/13/14 when the citizen selected one; null for GPS/manual-only. */
    ward: smallint("ward"),
    /** Option A — chosen from the DB-backed area list; nullable for manual entry. */
    areaId: uuid("area_id").references(() => areas.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    description: text("description").notNull(),
    /** Server-side file name inside UPLOAD_DIR (never a public path). */
    photoPath: text("photo_path"),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    addressText: text("address_text"),
    /**
     * Option C — free text typed by the citizen (colony / road / landmark).
     * LABELLED "Citizen-provided location" in the UI and NEVER copied into the
     * official `areas` list.
     */
    manualLocationText: text("manual_location_text"),
    /**
     * How the location was supplied. Derived server-side, never trusted raw:
     * selected_area | gps | manual | gps_and_manual
     */
    locationMethod: text("location_method", {
      enum: ["selected_area", "gps", "manual", "gps_and_manual"],
    }),
    status: text("status", { enum: ["pending", "in_progress", "resolved"] })
      .notNull()
      .default("pending"),
    assignedOfficerId: uuid("assigned_officer_id").references(() => officers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("complaints_tracking_uq").on(t.trackingId),
    index("complaints_ward_status_idx").on(t.ward, t.status),
    index("complaints_mobile_idx").on(t.citizenMobile),
    index("complaints_created_idx").on(t.createdAt),
  ],
);

/**
 * Immutable audit history. Every lifecycle event (creation, status change,
 * assignment, remark) is appended here and never updated or deleted.
 */
export const complaintEvents = pgTable(
  "complaint_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    complaintId: uuid("complaint_id")
      .notNull()
      .references(() => complaints.id),
    type: text("type", {
      enum: ["created", "status_changed", "assigned", "remark_added"],
    }).notNull(),
    /** Display label, e.g. 'Citizen', 'Officer: R. Verma', 'Admin'. */
    actorLabel: text("actor_label").notNull(),
    actorOfficerId: uuid("actor_officer_id").references(() => officers.id),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    remark: text("remark"),
    /** Private events are visible to officers only, never to citizens. */
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_complaint_idx").on(t.complaintId, t.createdAt)],
);

/**
 * ==========================================================================
 * WARD REFERENCE DATA (published source data — NOT citizen complaints)
 * ==========================================================================
 *
 * Provenance is first-class here: every ward/locality mapping records WHERE it
 * came from, WHO published it, which DELIMITATION and YEAR it describes, when
 * it was checked, and whether that check succeeded.
 *
 * Scope rule: the Rajasthan LSG Department 2024 Swachhtam Portal PDF is a
 * source for THAT (2024) delimitation dataset ONLY. It is NOT evidence of the
 * current 2025 merged-JMC ward boundaries, which remain 'needs_verification'.
 */

export const wardDelimitations = pgTable(
  "ward_delimitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Stable code, e.g. '2024-swachhtam', '2025-merged-jmc' */
    code: text("code").notNull(),
    /** Human label shown in the UI alongside the year. */
    title: text("title").notNull(),
    /** e.g. 'Rajasthan LSG Department' */
    publisher: text("publisher").notNull(),
    /** e.g. 'Swachhtam Portal PDF (2024)' */
    source: text("source").notNull(),
    sourceUrl: text("source_url"),
    /** Which delimitation this dataset describes. */
    delimitation: text("delimitation").notNull(),
    delimitationYear: smallint("delimitation_year").notNull(),
    /**
     * 'verified'        — locality list checked against THIS source document
     * 'needs_verification' — cannot be confirmed from available sources
     * 'not_applicable'  — dataset explicitly out of scope of that source
     */
    verificationStatus: text("verification_status", {
      enum: ["verified", "needs_verification", "not_applicable"],
    })
      .notNull()
      .default("needs_verification"),
    /** Date the check was actually performed (never a guess). */
    verifiedOn: timestamp("verified_on", { withTimezone: true }),
    /** True for the delimitation currently in force, if known. */
    isCurrent: boolean("is_current").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ward_delimitations_code_uq").on(t.code)],
);

/**
 * Ward ↔ locality mappings tied to a specific delimitation.
 * Import only from a documented source; locality names are NEVER invented here.
 */
export const wardLocalities = pgTable(
  "ward_localities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    delimitationId: uuid("delimitation_id")
      .notNull()
      .references(() => wardDelimitations.id),
    ward: smallint("ward").notNull(),
    localityName: text("locality_name").notNull(),
    verificationStatus: text("verification_status", {
      enum: ["verified", "needs_verification", "unverified"],
    })
      .notNull()
      .default("needs_verification"),
    verifiedOn: timestamp("verified_on", { withTimezone: true }),
    /** Page/section reference in the source document, if available. */
    sourceRef: text("source_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ward_localities_uq").on(t.delimitationId, t.ward, t.localityName),
    index("ward_localities_ward_idx").on(t.ward),
  ],
);

export type Area = typeof areas.$inferSelect;
export type WardDelimitation = typeof wardDelimitations.$inferSelect;
export type WardLocality = typeof wardLocalities.$inferSelect;
export type VerificationStatus = WardLocality["verificationStatus"];
export type Category = typeof categories.$inferSelect;
export type Officer = typeof officers.$inferSelect;
export type Complaint = typeof complaints.$inferSelect;
export type ComplaintEvent = typeof complaintEvents.$inferSelect;
export type OfficerRole = Officer["role"];
export type ComplaintStatus = Complaint["status"];
