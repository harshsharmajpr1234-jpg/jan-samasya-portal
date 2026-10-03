import { db } from "@/db";
import { areas, categories, complaintEvents, complaints } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { trackComplaintSchema } from "@/lib/validators";
import { handlePreflight, jsonResponse } from "@/lib/cors";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { signMediaToken } from "@/lib/media-token";
import { isJwtSecretConfigured } from "@/lib/jwt";
import { STATUS_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return handlePreflight(req);
}

const NOT_FOUND_MSG =
  "No complaint found for this Tracking ID and mobile number combination.";

/**
 * Secure citizen tracking: requires BOTH the unique Tracking ID and the
 * registered mobile number, so a tracking ID alone cannot expose a complaint.
 * Heavily rate-limited to frustrate enumeration.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`track:${clientIp(req)}`, 10, 10 * 60 * 1000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse(req, { error: "Invalid request body" }, { status: 400 });
  }

  const parsed = trackComplaintSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(
      req,
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { trackingId, mobile } = parsed.data;

  const [row] = await db
    .select({
      complaint: complaints,
      areaName: areas.name,
      categoryNameEn: categories.nameEn,
      categoryNameHi: categories.nameHi,
    })
    .from(complaints)
    // LEFT join: complaints filed via GPS/manual have no area row.
    .leftJoin(areas, eq(complaints.areaId, areas.id))
    .innerJoin(categories, eq(complaints.categoryId, categories.id))
    .where(and(eq(complaints.trackingId, trackingId), eq(complaints.citizenMobile, mobile)))
    .limit(1);

  // Identical response whether the ID or the mobile is wrong (prevents probing).
  if (!row) {
    return jsonResponse(req, { error: NOT_FOUND_MSG }, { status: 404 });
  }

  const c = row.complaint;
  const events = await db
    .select()
    .from(complaintEvents)
    .where(and(eq(complaintEvents.complaintId, c.id), eq(complaintEvents.isPublic, true)))
    .orderBy(asc(complaintEvents.createdAt));

  // Citizens see role labels, not individual officer names.
  const timeline = events.map((e) => ({
    type: e.type,
    label: e.type === "created" ? "Citizen" : "Ward Office",
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    remark: e.remark,
    at: e.createdAt,
  }));

  // Short-lived token authorising this citizen to view their own photo.
  // Degrade gracefully: if the server cannot sign a token (JWT_SECRET missing),
  // still return the complaint — tracking must never fail because of a photo.
  let mediaToken: string | null = null;
  if (c.photoPath && isJwtSecretConfigured()) {
    try {
      mediaToken = await signMediaToken(c.trackingId);
    } catch (err) {
      console.error("media-token-sign-failed", err);
      mediaToken = null;
    }
  }

  return jsonResponse(req, {
    trackingId: c.trackingId,
    status: c.status,
    statusLabel: STATUS_LABEL[c.status],
    ward: c.ward,
    area: row.areaName,
    locationMethod: c.locationMethod,
    /** Citizen-typed location, presented under the required label. */
    manualLocationText: c.manualLocationText,
    locationLabel: c.manualLocationText ? "Citizen-provided location" : null,
    category: { nameEn: row.categoryNameEn, nameHi: row.categoryNameHi },
    description: c.description,
    addressText: c.addressText,
    lat: c.lat === null ? null : Number(c.lat),
    lng: c.lng === null ? null : Number(c.lng),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    resolvedAt: c.resolvedAt,
    timeline,
    photoUrl: c.photoPath && mediaToken ? `/api/media/${c.photoPath}?mt=${mediaToken}` : null,
    photoAvailable: Boolean(c.photoPath),
  });
}
