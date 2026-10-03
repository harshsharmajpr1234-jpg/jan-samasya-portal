import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  canAssign,
  canUpdateComplaint,
  canViewComplaint,
  hasAllWards,
  visibleWards,
  wardFilterFor,
} from "@/lib/rbac";
import { formatTrackingId, randomTrackingCode } from "@/lib/tracking";
import type { SessionPayload } from "@/lib/jwt";

describe("bcrypt password hashing", () => {
  it("hashes and verifies; rejects wrong passwords", async () => {
    const hash = await hashPassword("Sup3rSecret!");
    expect(hash).not.toContain("Sup3rSecret!");
    expect(await verifyPassword("Sup3rSecret!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("tracking ID format", () => {
  it("matches JSNM-<ward>-<6 unambiguous chars>", () => {
    for (const ward of [12, 13, 14]) {
      expect(formatTrackingId(ward)).toMatch(/^JSNM-(12|13|14)-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    }
  });
  it("avoids ambiguous characters (0,O,1,I,L)", () => {
    for (let i = 0; i < 50; i++) {
      expect(randomTrackingCode(12)).not.toMatch(/[01OIL]/);
    }
  });
});

describe("role-based access control", () => {
  const admin: SessionPayload = {
    sub: "a", name: "Admin", email: "a@x", role: "admin", ward: null, wardScope: "all",
  };
  const officer13: SessionPayload = {
    sub: "o", name: "Ofcr", email: "o@x", role: "officer", ward: 13, wardScope: "single",
  };

  it("the all-wards scope covers every configured ward", () => {
    expect(canViewComplaint(admin, { ward: 12 })).toBe(true);
    expect(canViewComplaint(admin, { ward: 14 })).toBe(true);
    expect(canAssign(admin)).toBe(true);
    expect(visibleWards(admin)).toBeNull();
    expect(hasAllWards(admin)).toBe(true);
  });

  it("the all-wards scope automatically covers wards added LATER (nothing is enumerated)", () => {
    // These ward numbers are NOT in any hardcoded list anywhere in the code —
    // an `all` scope must still include them.
    for (const futureWard of [15, 27, 41, 99, 123]) {
      expect(canViewComplaint(admin, { ward: futureWard })).toBe(true);
      expect(canUpdateComplaint(admin, { ward: futureWard })).toBe(true);
    }
    expect(visibleWards(admin)).toBeNull();
  });

  it("ordinary officers remain confined to their own ward", () => {
    expect(canViewComplaint(officer13, { ward: 13 })).toBe(true);
    expect(canViewComplaint(officer13, { ward: 12 })).toBe(false);
    expect(canUpdateComplaint(officer13, { ward: 14 })).toBe(false);
    expect(canAssign(officer13)).toBe(false);
    expect(visibleWards(officer13)).toEqual([13]);
    expect(hasAllWards(officer13)).toBe(false);
  });

  it("ordinary officers cannot reach wards added later either", () => {
    for (const futureWard of [15, 27, 99]) {
      expect(canViewComplaint(officer13, { ward: futureWard })).toBe(false);
    }
  });

  it("role alone does NOT imply all-ward access — the scope must be granted explicitly", () => {
    // An admin without the `all` scope is still restricted to its own ward.
    const wardScopedAdmin: SessionPayload = {
      sub: "b", name: "Scoped", email: "b@x", role: "admin", ward: 12, wardScope: "single",
    };
    expect(canViewComplaint(wardScopedAdmin, { ward: 12 })).toBe(true);
    expect(canViewComplaint(wardScopedAdmin, { ward: 13 })).toBe(false);
    expect(hasAllWards(wardScopedAdmin)).toBe(false);
    expect(visibleWards(wardScopedAdmin)).toEqual([12]);
  });

  it("unassigned officers see nothing", () => {
    const unassigned: SessionPayload = {
      sub: "c", name: "None", email: "c@x", role: "officer", ward: null, wardScope: "single",
    };
    expect(visibleWards(unassigned)).toEqual([]);
    expect(canViewComplaint(unassigned, { ward: 13 })).toBe(false);
  });

  it("wardFilterFor omits the predicate entirely for the all-wards scope", () => {
    expect(wardFilterFor(admin)).toBeNull();
    expect(wardFilterFor(admin, 27)).toEqual([27]);
    expect(wardFilterFor(officer13)).toEqual([13]);
  });
});
