import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let uploads: typeof import("@/lib/uploads");

beforeAll(async () => {
  process.env.UPLOAD_DIR = mkdtempSync(path.join(tmpdir(), "jsnm-uploads-"));
  uploads = await import("@/lib/uploads");
});

describe("restricted upload handling", () => {
  it("accepts a genuine PNG and stores it with a safe random name", async () => {
    const file = new File([PNG_1PX], "evidence.png", { type: "image/png" });
    const saved = await uploads.validateAndSaveUpload(file);
    expect("error" in saved).toBe(false);
    if (!("error" in saved)) {
      expect(uploads.isSafeUploadName(saved.fileName)).toBe(true);
      expect(await uploads.readUpload(saved.fileName)).not.toBeNull();
    }
  });

  it("rejects content that only pretends to be an image", async () => {
    const file = new File([Buffer.from("<script>alert(1)</script>")], "evil.png", { type: "image/png" });
    const saved = await uploads.validateAndSaveUpload(file);
    expect("error" in saved).toBe(true);
  });

  it("rejects disallowed mime types and oversize files", async () => {
    const gif = new File([PNG_1PX], "x.gif", { type: "image/gif" });
    expect("error" in await uploads.validateAndSaveUpload(gif)).toBe(true);
    const big = new File([new Uint8Array(5 * 1024 * 1024)], "big.png", { type: "image/png" });
    expect("error" in await uploads.validateAndSaveUpload(big)).toBe(true);
  });

  it("never serves path-traversal style names", async () => {
    expect(uploads.isSafeUploadName("../../etc/passwd")).toBe(false);
    expect(uploads.isSafeUploadName("secret.png")).toBe(false);
    expect(await uploads.readUpload("../.env")).toBeNull();
  });
});
