import { z } from "zod";
import { TRACKING_ID_PREFIX } from "./constants";

/** Indian mobile numbers: 10 digits, starting 6-9. Mandatory for citizens. */
export const mobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, "").slice(-10))
  .pipe(
    z
      .string()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number (starting with 6-9)"),
  );

/**
 * A ward NUMBER format check only. Whether a ward is actually served is decided
 * by the ward configuration (`wards` table) and checked server-side via
 * `isWardConfigured()` — so newly configured wards need no code change here.
 */
export const wardSchema = z.coerce
  .number({ message: "Ward must be a number" })
  .int("Ward must be a whole number")
  .refine((w) => [12, 13, 14].includes(w), "Ward selection must be Ward 12, 13, or 14");

export const trackingIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    // "00" = complaint filed without selecting a ward (GPS / manual location only).
    new RegExp(`^${TRACKING_ID_PREFIX}-(12|13|14|00)-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$`),
    "Tracking ID looks invalid (format: JSNM-12-XXXXXX)",
  );

export const latSchema = z.coerce.number().min(-90).max(90);
export const lngSchema = z.coerce.number().min(-180).max(180);

/**
 * Option C — citizen-typed location: colony, road, landmark or full address.
 * Trims leading/trailing whitespace and collapses repeated whitespace so we
 * never store "unnecessary whitespace". Length is validated on the normalised
 * value. The text is stored exactly as worded otherwise — never rewritten and
 * never required to match an existing area in the database.
 */
export const manualLocationSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(5, "Complete problem address is required (at least 5 characters)")
      .max(200, "Location text is limited to 200 characters"),
  );

export const createComplaintSchema = z
  .object({
    citizenName: z.string().trim().min(2, "Full name is required (at least 2 characters)").max(80, "Name is too long"),
    citizenMobile: mobileSchema,
    /** Ward selection — Ward 12, 13, or 14 mandatory. */
    ward: wardSchema,
    areaId: z.string().uuid("Select a valid area").optional(),
    categoryId: z.string().uuid("Select a valid category"),
    description: z
      .string()
      .trim()
      .min(10, "Please describe the problem in at least 10 characters")
      .max(1000, "Description is limited to 1000 characters"),
    /**
     * REQUIRED citizen-typed location: colony, road, landmark or the full
     * problem location. Never required to match an existing DB area record.
     */
    manualLocationText: manualLocationSchema,
    addressText: z.string().trim().max(200, "Address is limited to 200 characters").optional().or(z.literal("")),
    /** Required nearby landmark (e.g. Near school, temple, main road) */
    landmarkText: z.string().trim().min(3, "Nearby landmark is required (at least 3 characters)").max(200, "Landmark text is limited to 200 characters"),
    /** Additional directions (optional, e.g. Opposite the park) */
    directionsText: z.string().trim().max(300, "Directions are limited to 300 characters").optional().or(z.literal("")),
    /** Option B — GPS. Both must be present to count as a GPS location. */
    lat: latSchema.optional(),
    lng: lngSchema.optional(),
  })
  .superRefine((v, ctx) => {
    // `manualLocationText` is required by the field schema above, so a usable
    // location description is always present. GPS is optional and never
    // blocks submission.

    // An area belongs to a ward, so the ward must accompany it.
    if (v.areaId !== undefined && v.ward === undefined) {
      ctx.addIssue({ code: "custom", message: "Select a ward before choosing an area", path: ["ward"] });
    }
    // Partial GPS is not a location.
    if ((v.lat !== undefined) !== (v.lng !== undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "Both latitude and longitude are needed for a GPS location.",
        path: ["lat"],
      });
    }
  });
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;

export const LOCATION_METHODS = ["selected_area", "gps", "manual", "gps_and_manual"] as const;
export type LocationMethod = (typeof LOCATION_METHODS)[number];

export function deriveLocationMethod(input: {
  areaId?: string;
  lat?: number | string;
  lng?: number | string;
  manualLocationText?: string;
}): LocationMethod {
  const hasArea = Boolean(input.areaId);
  const hasGps = input.lat !== undefined && input.lng !== undefined && String(input.lat) !== "";
  const hasManual = Boolean(input.manualLocationText && input.manualLocationText.trim().length > 0);

  if (hasGps && hasManual) return "gps_and_manual";
  if (hasGps) return "gps";
  if (hasArea) return "selected_area";
  return "manual";
}

export const trackComplaintSchema = z.object({
  trackingId: trackingIdSchema,
  mobile: mobileSchema,
});

export const citizenRegisterSchema = z
  .object({
    name: z.string().trim().min(2, "Full name is too short").max(80, "Full name is too long"),
    mobile: mobileSchema,
    email: z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("")),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirmPassword) {
      ctx.addIssue({ code: "custom", message: "Passwords do not match", path: ["confirmPassword"] });
    }
  });

export const citizenLoginSchema = z.object({
  mobile: mobileSchema,
  password: z.string().min(1, "Password is required").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required").max(100),
});

export const statusUpdateSchema = z.object({
  action: z.literal("status"),
  toStatus: z.enum(["pending", "in_progress", "resolved"]),
  remark: z.string().trim().max(500).optional().or(z.literal("")),
  isPublic: z.boolean().optional().default(true),
});

export const assignSchema = z.object({
  action: z.literal("assign"),
  officerId: z.string().uuid(),
});

export const remarkSchema = z.object({
  action: z.literal("remark"),
  text: z.string().trim().min(1, "Remark cannot be empty").max(500),
  isPublic: z.boolean().optional().default(true),
});

export const complaintPatchSchema = z.discriminatedUnion("action", [
  statusUpdateSchema,
  assignSchema,
  remarkSchema,
]);

export const createOfficerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .max(100)
      .regex(/[A-Za-z]/, "Password needs a letter")
      .regex(/\d/, "Password needs a digit"),
    role: z.enum(["admin", "officer"]),
    /**
     * Explicit scope. Default is the least privilege ('single'); 'all' must be
     * requested deliberately and is checked against the ward configuration by
     * the calling route (it is never inferred from the role).
     */
    wardScope: z.enum(["all", "single"]).optional().default("single"),
    ward: z.coerce.number().int().min(1).max(999).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.wardScope === "single" && v.ward === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "A ward number is required unless the account is explicitly granted the all-wards scope",
        path: ["ward"],
      });
    }
  });

export const createAreaSchema = z.object({
  ward: wardSchema,
  name: z.string().trim().min(2).max(80),
});

export const officerListQuerySchema = z.object({
  ward: z.coerce.number().optional(),
  status: z.enum(["pending", "in_progress", "resolved"]).optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
