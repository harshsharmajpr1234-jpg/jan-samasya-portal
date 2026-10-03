import { randomInt } from "crypto";
import { TRACKING_ID_PREFIX } from "./constants";

// The DB is imported lazily inside functions so that pure helpers (formatTrackingId,
// randomTrackingCode) can be used — and unit-tested — without a live DATABASE_URL.

/** Unambiguous alphabet: no 0/O, 1/I/L to survive phone calls and handwriting. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function randomTrackingCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/**
 * e.g. JSNM-12-KF4Q7X — unique per complaint, ward encoded for readability.
 * Complaints filed without selecting a ward (GPS / manual location only) use
 * "00" in the ward slot so the ID stays human-readable and parseable.
 */
export function formatTrackingId(ward: number | null): string {
  return `${TRACKING_ID_PREFIX}-${ward ?? "00"}-${randomTrackingCode(6)}`;
}

/** Generates a tracking ID, retrying on the (astronomically rare) collision. */
export async function generateUniqueTrackingId(ward: number | null): Promise<string> {
  const { db } = await import("@/db");
  const { complaints } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = formatTrackingId(ward);
    const existing = await db
      .select({ id: complaints.id })
      .from(complaints)
      .where(eq(complaints.trackingId, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  throw new Error("Could not allocate a tracking ID, please retry");
}

export interface AuditEventInput {
  complaintId: string;
  type: "created" | "status_changed" | "assigned" | "remark_added";
  actorLabel: string;
  actorOfficerId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  remark?: string | null;
  isPublic?: boolean;
}

/** Appends an immutable audit-history entry. Events are never edited/deleted. */
export async function addAuditEvent(input: AuditEventInput) {
  const { db } = await import("@/db");
  const { complaintEvents } = await import("@/db/schema");
  await db.insert(complaintEvents).values({
    complaintId: input.complaintId,
    type: input.type,
    actorLabel: input.actorLabel,
    actorOfficerId: input.actorOfficerId ?? null,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    remark: input.remark ?? null,
    isPublic: input.isPublic ?? true,
  });
}
