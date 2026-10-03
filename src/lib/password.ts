import bcrypt from "bcryptjs";

const ROUNDS = 10;

/** Secure password hashing (bcrypt, per-user salt). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * True when a stored secret looks like a bcrypt digest we can actually verify.
 * Used to tell "wrong password" apart from "this row was never bcrypt-hashed",
 * which are very different operational problems — without ever exposing the
 * stored value.
 */
export function isBcryptHash(hash: unknown): boolean {
  return typeof hash === "string" && /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
}

/**
 * Non-reversible description of a stored secret for logs: the algorithm only.
 * Never returns any part of the digest, salt or plaintext.
 */
export function describeHashFormat(hash: unknown): string {
  if (typeof hash !== "string" || hash.length === 0) return "empty";
  if (isBcryptHash(hash)) {
    const m = /^\$2([aby])?\$/.exec(hash);
    return `bcrypt-2${m?.[1] ?? "y"}`;
  }
  if (hash.startsWith("$2")) return "bcrypt-malformed";
  if (hash.startsWith("$")) return "unknown-crypt";
  return "plaintext-or-unsupported";
}
