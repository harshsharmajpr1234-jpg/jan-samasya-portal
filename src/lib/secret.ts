import { existsSync, readFileSync } from "fs";
import path from "path";

/**
 * Centralised JWT secret resolution.
 *
 * The secret is resolved from, in order:
 *   1. `JWT_SECRET`            — normal case (host environment / .env)
 *   2. `JWT_SECRET_FILE`       — a path to a file holding the secret
 *      (default `./data/.jwt-secret`)
 *
 * Why the file fallback exists: some hosting setups rewrite `.env` on deploy,
 * which silently drops `JWT_SECRET` and breaks every sign-in with a 503. When
 * that happens the operator can point `JWT_SECRET_FILE` at a gitignored file
 * outside `.env` and sign-in works again without touching application code.
 *
 * The secret is NEVER printed, logged, hardcoded or sent to the browser.
 */
const MIN_LENGTH = 32;

const DEFAULT_SECRET_FILE = path.join(process.cwd(), "data", ".jwt-secret");

function fromEnv(): string | null {
  const value = process.env.JWT_SECRET;
  return typeof value === "string" && value.length >= MIN_LENGTH ? value : null;
}

function fromFile(): string | null {
  const filePath = process.env.JWT_SECRET_FILE || DEFAULT_SECRET_FILE;
  try {
    if (!existsSync(filePath)) return null;
    const value = readFileSync(filePath, "utf8").trim();
    return value.length >= MIN_LENGTH ? value : null;
  } catch {
    return null;
  }
}

/** Resolved secret bytes, or null when nothing is configured. */
export function getJwtSecret(): Uint8Array | null {
  const secret = fromEnv() ?? fromFile();
  return secret ? new TextEncoder().encode(secret) : null;
}

/** Non-throwing probe used by health/login to fail clearly instead of 500. */
export function isJwtSecretConfigured(): boolean {
  return getJwtSecret() !== null;
}

/** Throws when the secret is required but missing. */
export function requireJwtSecret(): Uint8Array {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error(
      "JWT secret is not configured. Set the JWT_SECRET environment variable (min 32 chars), " +
        "or set JWT_SECRET_FILE to a file containing it.",
    );
  }
  return secret;
}

/** Where the secret came from — safe to log, contains no secret material. */
export function jwtSecretSource(): "env" | "file" | "missing" {
  if (fromEnv()) return "env";
  if (fromFile()) return "file";
  return "missing";
}
