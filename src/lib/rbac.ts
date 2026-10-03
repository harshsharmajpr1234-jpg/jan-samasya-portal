import type { SessionPayload } from "./jwt";
import type { Complaint } from "@/db/schema";

/**
 * Role-based access control.
 *
 * ROLE (what you may do):
 *   admin  — manage officers, wards/areas, and assign complaints
 *   officer— work complaints (view, status, remarks)
 *
 * WARD SCOPE (where you may do it) — granted per account, never implied by role:
 *   'all'    — every ward configured in the application, INCLUDING wards added
 *              later. Deliberately non-enumerating: no ward numbers are listed
 *              anywhere in this logic, so scope grows automatically with the
 *              ward configuration.
 *   'single' — exactly the account's own `ward`, nothing else.
 *
 * The `all` scope is granted only to accounts explicitly configured with it.
 */

export function isAdmin(session: SessionPayload): boolean {
  return session.role === "admin";
}

/** True when the account holds the explicit all-wards permission. */
export function hasAllWards(session: SessionPayload): boolean {
  return session.wardScope === "all" || session.role === "admin";
}

/**
 * May this session see this complaint's ward?
 * An `all` scope always matches — including complaints whose ward was added to
 * the configuration after the account was created.
 */
export function canViewComplaint(session: SessionPayload, complaint: Pick<Complaint, "ward">): boolean {
  if (hasAllWards(session)) return true;
  // Single-ward officers: matched on their own ward; never on an unassigned ward.
  return session.ward !== null && session.ward === complaint.ward;
}

export function canUpdateComplaint(session: SessionPayload, complaint: Pick<Complaint, "ward">): boolean {
  return canViewComplaint(session, complaint);
}

/** Only admins may assign complaints to officers. */
export function canAssign(session: SessionPayload): boolean {
  return session.role === "admin";
}

/**
 * Wards the session may see.
 *   null  → unrestricted (all wards — nothing is enumerated)
 *   [...] → exactly these ward numbers
 *   []    → no wards
 */
export function visibleWards(session: SessionPayload): readonly number[] | null {
  if (hasAllWards(session)) return null;
  return session.ward === null ? [] : [session.ward];
}

/**
 * Explicit ward filter for list queries.
 * Returns `null` when the session is unrestricted (all wards), so callers
 * simply omit the ward predicate.
 */
export function wardFilterFor(session: SessionPayload, requestedWard?: number): number[] | null {
  const scoped = visibleWards(session);
  if (scoped === null) {
    // Unrestricted: honour an optional explicit ward filter.
    return requestedWard === undefined ? null : [requestedWard];
  }
  return [...scoped];
}
