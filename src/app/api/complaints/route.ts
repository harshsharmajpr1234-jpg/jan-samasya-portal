import { db } from "@/db";
import { areas, categories, complaintEvents, complaints } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createComplaintSchema, deriveLocationMethod } from "@/lib/validators";
import { handlePreflight, jsonResponse } from "@/lib/cors";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { generateUniqueTrackingId } from "@/lib/tracking";
import { validateAndSaveUpload } from "@/lib/uploads";
import { isWardConfigured } from "@/lib/wards";
import { STATUS_LABEL } from "@/lib/constants";
import { getCitizenSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return handlePreflight(req);
}

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

/**
 * Public: register a complaint (Ward 12/13/14 only).
 * Accepts multipart/form-data (with optional `photo`) or application/json.
 * Mobile number is mandatory and becomes the citizen's tracking credential.
 */
export async function POST(req: Request) {
  const citizenSession = await getCitizenSession();

  // Rate limit: 5 complaint registrations per 10 minutes per IP.
  const rl = rateLimit(`complaint:${clientIp(req)}`, 5, 10 * 60 * 1000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

  // --- Parse body ---
  let raw: Record<string, unknown>;
  let photo: File | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const maybePhoto = form.get("photo");
      if (maybePhoto instanceof File && maybePhoto.size > 0) photo = maybePhoto;
      raw = {
        citizenName: str(form.get("citizenName")) || citizenSession?.name,
        citizenMobile: str(form.get("citizenMobile")) || citizenSession?.mobile,
        ward: str(form.get("ward")),
        areaId: str(form.get("areaId")),
        categoryId: str(form.get("categoryId")),
        description: str(form.get("description")),
        addressText: str(form.get("addressText")),
        landmarkText: str(form.get("landmarkText")),
        directionsText: str(form.get("directionsText")),
        manualLocationText: str(form.get("manualLocationText")),
        lat: str(form.get("lat")),
        lng: str(form.get("lng")),
      };
    } else if (contentType.includes("application/json")) {
      raw = await req.json();
    } else {
      return jsonResponse(req, { error: "Unsupported content type" }, { status: 415 });
    }
  } catch {
    return jsonResponse(req, { error: "Could not read the submitted form" }, { status: 400 });
  }

  // --- Validate input ---
  const parsed = createComplaintSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(
      req,
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // --- Ward must be part of the application's ward configuration ---
  if (input.ward !== undefined && !(await isWardConfigured(input.ward))) {
    return jsonResponse(req, { error: "This ward is not currently configured in the portal." }, { status: 400 });
  }

  // --- Referential checks ---
  let area: typeof areas.$inferSelect | undefined;
  if (input.areaId !== undefined) {
    const [found] = await db
      .select()
      .from(areas)
      .where(and(eq(areas.id, input.areaId), eq(areas.active, true)))
      .limit(1);
    if (!found) {
      return jsonResponse(req, { error: "The selected area does not exist. Please pick it again." }, { status: 400 });
    }
    if (input.ward !== undefined && found.ward !== input.ward) {
      return jsonResponse(req, { error: "Selected area does not belong to the chosen ward" }, { status: 400 });
    }
    area = found;
  }
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, input.categoryId), eq(categories.active, true)))
    .limit(1);
  if (!category) {
    return jsonResponse(req, { error: "Selected category is not available" }, { status: 400 });
  }

  // --- Photo (mandatory, restricted storage) ---
  if (!photo) {
    return jsonResponse(
      req,
      {
        error: "At least one photograph of the problem is required",
        issues: { photo: ["At least one photograph of the problem is required"] },
      },
      { status: 400 },
    );
  }

  let photoPath: string | null = null;
  const saved = await validateAndSaveUpload(photo);
  if ("error" in saved) {
    return jsonResponse(
      req,
      { error: saved.error, issues: { photo: [saved.error] } },
      { status: 400 },
    );
  }
  photoPath = saved.fileName;

  // --- Persist (complaint + immutable audit event, atomically) ---
  try {
    const ward = input.ward ?? null;
    const trackingId = await generateUniqueTrackingId(ward);
    const locationMethod = deriveLocationMethod(input);
    const locationLabel = area
      ? `${area.name}${ward !== null ? `, Ward ${ward}` : ""}`
      : input.manualLocationText
        ? `Citizen-provided location: ${input.manualLocationText}`
        : "GPS location captured";

    const [created] = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(complaints)
        .values({
          citizenId: citizenSession?.sub ?? null,
          trackingId,
          citizenName: input.citizenName,
          citizenMobile: input.citizenMobile,
          ward,
          areaId: input.areaId ?? null,
          categoryId: input.categoryId,
          description: input.description,
          addressText: input.addressText || null,
          landmarkText: input.landmarkText || null,
          directionsText: input.directionsText || null,
          manualLocationText: input.manualLocationText ?? null,
          locationMethod,
          lat: input.lat !== undefined ? String(input.lat) : null,
          lng: input.lng !== undefined ? String(input.lng) : null,
          photoPath,
        })
        .returning();
      await tx.insert(complaintEvents).values({
        complaintId: row.id,
        type: "created",
        actorLabel: "Citizen",
        toStatus: "pending",
        remark: `Complaint registered under ${category.nameEn} (${locationLabel})`,
        isPublic: true,
      });
      return [row];
    });

    return jsonResponse(
      req,
      {
        trackingId: created.trackingId,
        status: created.status,
        statusLabel: STATUS_LABEL[created.status],
        ward: created.ward,
        createdAt: created.createdAt,
        message:
          "Complaint registered. Save your Tracking ID — you will need it together with your mobile number to track progress.",
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("complaint-create-failed", err);
    return jsonResponse(req, { error: "Could not register the complaint. Please try again." }, { status: 500 });
  }
}
