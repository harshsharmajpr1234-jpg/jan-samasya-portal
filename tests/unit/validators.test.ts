import { describe, expect, it } from "vitest";
import {
  createComplaintSchema,
  loginSchema,
  mobileSchema,
  statusUpdateSchema,
  trackComplaintSchema,
  wardSchema,
} from "@/lib/validators";

const validUuid = "123e4567-e89b-12d3-a456-426614174000";

describe("mobile validation (mandatory citizen credential)", () => {
  it("accepts valid Indian mobiles", () => {
    for (const m of ["9876543210", "6123456789", "7000000000", "8999911111"]) {
      expect(mobileSchema.safeParse(m).success).toBe(true);
    }
  });
  it("rejects invalid mobiles", () => {
    for (const m of ["5876543210", "1234567890", "98765432", "abcdefghij", "98765432101", ""]) {
      expect(mobileSchema.safeParse(m).success).toBe(false);
    }
  });
});

describe("ward NUMBER format (membership is config-driven, not hardcoded)", () => {
  it("accepts any positive integer ward number", () => {
    for (const w of [12, 13, 14, 15, 27, 101]) {
      expect(wardSchema.safeParse(w).success).toBe(true);
    }
    expect(wardSchema.safeParse("13").success).toBe(true);
  });
  it("rejects non-numbers and out-of-range values", () => {
    for (const w of [0, -3, 1000, "abc", 1.5]) {
      expect(wardSchema.safeParse(w).success).toBe(false);
    }
  });
});

describe("tracking schema", () => {
  it("requires tracking id + mobile together", () => {
    expect(trackComplaintSchema.safeParse({ trackingId: "JSNM-12-KF4Q7X", mobile: "9876543210" }).success).toBe(true);
    expect(trackComplaintSchema.safeParse({ trackingId: "JSNM-99-KF4Q7X", mobile: "9876543210" }).success).toBe(false);
    expect(trackComplaintSchema.safeParse({ trackingId: "random", mobile: "9876543210" }).success).toBe(false);
    expect(trackComplaintSchema.safeParse({ mobile: "9876543210" }).success).toBe(false);
  });
});

describe("complaint creation schema", () => {
  const base = {
    citizenName: "Test Citizen",
    citizenMobile: "9876543210",
    ward: 13,
    areaId: validUuid,
    categoryId: validUuid,
    description: "The streetlight outside my house is broken for a week.",
    manualLocationText: "Lane behind the primary school, near the market",
  };
  it("accepts a full valid payload", () => {
    expect(createComplaintSchema.safeParse(base).success).toBe(true);
  });
  it("rejects short descriptions and bad uuids", () => {
    expect(createComplaintSchema.safeParse({ ...base, description: "bad" }).success).toBe(false);
    expect(createComplaintSchema.safeParse({ ...base, areaId: "not-a-uuid" }).success).toBe(false);
  });
  it("validates lat/lng ranges", () => {
    expect(createComplaintSchema.safeParse({ ...base, lat: 91 }).success).toBe(false);
    expect(createComplaintSchema.safeParse({ ...base, lat: "26.85", lng: "80.94" }).success).toBe(true);
  });
});

describe("officer input schemas", () => {
  it("login requires email + password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });
  it("status updates use the fixed status enum", () => {
    expect(statusUpdateSchema.safeParse({ action: "status", toStatus: "in_progress" }).success).toBe(true);
    expect(statusUpdateSchema.safeParse({ action: "status", toStatus: "done" }).success).toBe(false);
  });
});
