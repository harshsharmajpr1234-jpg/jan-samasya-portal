import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
} from "./constants";

/**
 * Zero-cost image storage: files are written to a private server directory
 * (default ./data/uploads) that is NOT publicly served. Photos can only be
 * read through `GET /api/media/[file]`, which enforces access control.
 *
 * Free hosted alternative (optional): swap `saveUpload`/`readUpload` for
 * Cloudinary or Supabase Storage free tier — see docs/DEPLOYMENT.md. Never
 * store photos in the database or in browser storage.
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/** Magic-byte sniffing so a renamed script cannot pose as an image. */
function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  )
    return "image/png";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}

export interface SavedUpload {
  fileName: string;
  size: number;
  mime: string;
}

export async function validateAndSaveUpload(
  file: File,
): Promise<SavedUpload | { error: string }> {
  if (file.size === 0) return { error: "The uploaded photo is empty" };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `Photo must be smaller than ${MAX_UPLOAD_MB} MB` };
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { error: "Only JPG, PNG or WebP photos are allowed" };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMime(buf);
  if (!sniffed || sniffed !== file.type) {
    return { error: "The file content is not a valid image" };
  }

  const fileName = `${randomUUID()}${EXT_BY_MIME[sniffed]}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  // Runtime path is dynamic by design (env-configurable private storage dir).
  await writeFile(path.join(/* turbopackIgnore: true */ UPLOAD_DIR, fileName), buf);
  return { fileName, size: file.size, mime: sniffed };
}

const SAFE_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export function isSafeUploadName(name: string): boolean {
  return SAFE_NAME.test(name);
}

export async function readUpload(fileName: string): Promise<Buffer | null> {
  if (!isSafeUploadName(fileName)) return null;
  try {
    return await readFile(path.join(/* turbopackIgnore: true */ UPLOAD_DIR, fileName));
  } catch {
    return null;
  }
}

export function mimeForUpload(fileName: string): string {
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
