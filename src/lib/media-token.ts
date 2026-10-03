import { SignJWT, jwtVerify } from "jose";
import { requireJwtSecret } from "./secret";

/**
 * Short-lived, single-purpose tokens that let a citizen view THEIR OWN
 * complaint photo after verifying tracking ID + mobile. This keeps private
 * media private without leaking PII in image URLs. Officers use their
 * session cookie instead of a media token.
 */
const MEDIA_TTL_SEC = 15 * 60; // 15 minutes

function getSecret(): Uint8Array {
  return requireJwtSecret();
}

export async function signMediaToken(trackingId: string): Promise<string> {
  return new SignJWT({ scope: "media" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(trackingId)
    .setIssuer("jsnm-media")
    .setIssuedAt()
    .setExpirationTime(`${MEDIA_TTL_SEC}s`)
    .sign(getSecret());
}

export async function verifyMediaToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: "jsnm-media" });
    if (payload.scope !== "media" || !payload.sub) return null;
    return String(payload.sub); // trackingId
  } catch {
    return null;
  }
}
