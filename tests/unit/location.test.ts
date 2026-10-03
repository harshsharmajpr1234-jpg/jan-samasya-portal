import { describe, expect, it } from "vitest";
import { createComplaintSchema, deriveLocationMethod } from "@/lib/validators";
import { formatTrackingId } from "@/lib/tracking";

const uuid = "123e4567-e89b-12d3-a456-426614174000";
const base = {
  citizenName: "Test Citizen",
  citizenMobile: "9876543210",
  categoryId: uuid,
  description: "The drain outside my house has been blocked for several days.",
  manualLocationText: "Lane behind the primary school, near the water tank",
};

describe("deriveLocationMethod", () => {
  it("reports manual when only citizen-typed text is supplied", () => {
    expect(deriveLocationMethod({ manualLocationText: "Near Shiv Mandir, Patel Road" })).toBe("manual");
  });

  it("reports gps_and_manual when BOTH GPS and manual text are supplied", () => {
    expect(
      deriveLocationMethod({ lat: 26.85, lng: 80.94, manualLocationText: "Near Shiv Mandir, Patel Road" }),
    ).toBe("gps_and_manual");
  });

  it("still understands legacy area / GPS-only payloads", () => {
    expect(deriveLocationMethod({ areaId: uuid })).toBe("selected_area");
    expect(deriveLocationMethod({ lat: 26.85, lng: 80.94 })).toBe("gps");
  });
});

describe("createComplaintSchema — citizen location rules", () => {
  it("REJECTS submission when the Colony/Area/Landmark text is missing", () => {
    const { manualLocationText: _omit, ...withoutLocation } = base;
    const res = createComplaintSchema.safeParse(withoutLocation);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(JSON.stringify(res.error.issues)).toContain("manualLocationText");
    }
  });

  it("accepts a typed location with NO GPS (GPS is optional)", () => {
    expect(createComplaintSchema.safeParse(base).success).toBe(true);
    expect(createComplaintSchema.safeParse({ ...base, lat: undefined, lng: undefined }).success).toBe(true);
  });

  it("accepts a typed location together with GPS coordinates", () => {
    expect(
      createComplaintSchema.safeParse({ ...base, lat: 26.85123, lng: 80.94321 }).success,
    ).toBe(true);
  });

  it("accepts any locality text, including names not in any database list", () => {
    expect(
      createComplaintSchema.safeParse({ ...base, manualLocationText: "Some Brand New Colony That Is Not Listed" })
        .success,
    ).toBe(true);
    expect(
      createComplaintSchema.safeParse({ ...base, manualLocationText: "123, Shanti Apartments, 2nd floor, near old bridge" })
        .success,
    ).toBe(true);
  });

  it("trims and collapses unnecessary whitespace in the typed location", () => {
    const res = createComplaintSchema.safeParse({ ...base, manualLocationText: "  Brand   New   Colony  " });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.manualLocationText).toBe("Brand New Colony");
    }
  });

  it("enforces length limits on the typed location", () => {
    expect(createComplaintSchema.safeParse({ ...base, manualLocationText: "ab" }).success).toBe(false);
    expect(createComplaintSchema.safeParse({ ...base, manualLocationText: "   " }).success).toBe(false);
    expect(createComplaintSchema.safeParse({ ...base, manualLocationText: "x".repeat(201) }).success).toBe(false);
    expect(createComplaintSchema.safeParse({ ...base, manualLocationText: "x".repeat(200) }).success).toBe(true);
  });

  it("keeps the ward selector: ward is optional and format-checked", () => {
    expect(createComplaintSchema.safeParse({ ...base, ward: 12 }).success).toBe(true);
    expect(createComplaintSchema.safeParse({ ...base, ward: 13 }).success).toBe(true);
    expect(createComplaintSchema.safeParse({ ...base, ward: 14 }).success).toBe(true);
    // Membership in the ward CONFIGURATION is enforced server-side, so a newly
    // configured ward needs no schema change here.
    expect(createComplaintSchema.safeParse({ ...base, ward: 15 }).success).toBe(true);
    expect(createComplaintSchema.safeParse({ ...base, ward: -1 }).success).toBe(false);
  });

  it("still requires a ward if a legacy area id is supplied", () => {
    const res = createComplaintSchema.safeParse({ ...base, areaId: uuid });
    expect(res.success).toBe(false);
    if (!res.success) expect(JSON.stringify(res.error.issues)).toContain("Select a ward");
    expect(createComplaintSchema.safeParse({ ...base, ward: 12, areaId: uuid }).success).toBe(true);
  });

  it("rejects partial GPS and never treats GPS as a substitute for the text", () => {
    const res = createComplaintSchema.safeParse({ ...base, lat: 26.85 });
    expect(res.success).toBe(false);
    if (!res.success) expect(JSON.stringify(res.error.issues)).toContain("latitude and longitude");
    expect(createComplaintSchema.safeParse({ lat: 26.85, lng: 80.94 }).success).toBe(false);
  });

  it("still validates name, mobile and description", () => {
    expect(createComplaintSchema.safeParse({ ...base, citizenMobile: "5876543210" }).success).toBe(false);
    expect(createComplaintSchema.safeParse({ ...base, description: "bad" }).success).toBe(false);
    expect(createComplaintSchema.safeParse({ ...base, citizenName: "A" }).success).toBe(false);
  });
});

describe("tracking IDs with optional ward", () => {
  it("uses 00 when no ward was selected", () => {
    expect(formatTrackingId(null)).toMatch(/^JSNM-00-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect(formatTrackingId(14)).toMatch(/^JSNM-14-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  });
});
