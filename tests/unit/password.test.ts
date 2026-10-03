import { describe, expect, it } from "vitest";
import { describeHashFormat, hashPassword, isBcryptHash, verifyPassword } from "@/lib/password";

const SECRET = "Sup3rSecret!42";

describe("bcrypt hashing and verification are compatible", () => {
  it("produces a bcrypt digest that verifyPassword accepts", async () => {
    const hash = await hashPassword(SECRET);
    expect(isBcryptHash(hash)).toBe(true);
    await expect(verifyPassword(SECRET, hash)).resolves.toBe(true);
    await expect(verifyPassword(`${SECRET}x`, hash)).resolves.toBe(false);
  });

  it("produces a per-user salt (same password, different digests)", async () => {
    const a = await hashPassword(SECRET);
    const b = await hashPassword(SECRET);
    expect(a).not.toBe(b);
    await expect(verifyPassword(SECRET, a)).resolves.toBe(true);
    await expect(verifyPassword(SECRET, b)).resolves.toBe(true);
  });
});

describe("hash format detection (diagnoses bad rows without exposing them)", () => {
  it("recognises valid bcrypt digests of every common variant", async () => {
    expect(isBcryptHash(await hashPassword(SECRET))).toBe(true);
    expect(isBcryptHash("$2a$10$" + "a".repeat(53))).toBe(true);
    expect(isBcryptHash("$2b$10$" + "b".repeat(53))).toBe(true);
  });

  it("rejects plaintext, malformed and foreign formats", () => {
    expect(isBcryptHash("hunter2")).toBe(false);
    expect(isBcryptHash("")).toBe(false);
    expect(isBcryptHash(undefined)).toBe(false);
    expect(isBcryptHash("$2b$10$tooshort")).toBe(false);
    expect(isBcryptHash("$6$rounds=5000$abcdef")).toBe(false);
    // a hash stored in a wrong/legacy column must not be silently verified
    expect(isBcryptHash(null)).toBe(false);
  });

  it("verifyPassword never throws on an unusable stored value", async () => {
    await expect(verifyPassword(SECRET, "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword(SECRET, "")).resolves.toBe(false);
    await expect(verifyPassword(SECRET, "$2b$10$tooshort")).resolves.toBe(false);
  });
});

describe("describeHashFormat is safe for logs", () => {
  it("reports only the algorithm, never any part of the digest or salt", async () => {
    const hash = await hashPassword(SECRET);
    const described = describeHashFormat(hash);
    expect(described).toBe("bcrypt-2b");
    // no fragment of the digest, salt or plaintext may appear
    expect(described.includes(hash)).toBe(false);
    for (let i = 0; i < hash.length - 4; i++) {
      expect(described.includes(hash.slice(i, i + 5))).toBe(false);
    }
    expect(described.includes(SECRET)).toBe(false);
  });

  it("labels unusable stored values so operators can tell them from wrong passwords", () => {
    expect(describeHashFormat("hunter2")).toBe("plaintext-or-unsupported");
    expect(describeHashFormat("$2b$10$tooshort")).toBe("bcrypt-malformed");
    expect(describeHashFormat("$6$rounds=5000$abcdef")).toBe("unknown-crypt");
    expect(describeHashFormat("")).toBe("empty");
    expect(describeHashFormat(null)).toBe("empty");
    expect(describeHashFormat(undefined)).toBe("empty");
  });
});
