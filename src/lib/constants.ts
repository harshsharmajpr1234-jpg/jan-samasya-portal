/**
 * Platform-wide constants.
 *
 * IMPORTANT: Jan Samasya Nivaran Manch supports ONLY Ward 12, 13 and 14.
 * Do not add wards without an explicit operational decision.
 */
/**
 * Ward numbers are NOT hardcoded here.
 *
 * The set of wards the portal serves is the "legitimate ward configuration"
 * stored in the `wards` table — see `src/lib/wards.ts`. Adding a ward there is
 * all that is required to serve it and to bring it into the scope of any
 * account holding the explicit `all wards` permission.
 *
 * The previous fixed list (12/13/14) is retained only as the INITIAL seed
 * content of that table in `scripts/seed.ts`, never as application logic.
 */

export const COMPLAINT_STATUSES = ["pending", "in_progress", "resolved"] as const;
export type ComplaintStatusValue = (typeof COMPLAINT_STATUSES)[number];

export const STATUS_LABEL: Record<ComplaintStatusValue, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export const APP_NAME = "Jan Samasya Nivaran Manch";
export const APP_NAME_HI = "जन समस्या निवारण मंच";

/** Shown across the UI — this is an independent citizen portal. */
export const INDEPENDENCE_DISCLAIMER =
  "Independent citizen grievance portal — not an official government or Nagar Nigam website, and not integrated with any government system.";

export const TRACKING_ID_PREFIX = "JSNM";

/** Upload limits (kept small so free-tier storage is never exceeded). */
export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 4);
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
