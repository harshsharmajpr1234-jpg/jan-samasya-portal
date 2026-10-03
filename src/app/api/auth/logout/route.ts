import { db } from "@/db";
import { officers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { clearSessionCookie } from "@/lib/cookies";

export const dynamic = "force-dynamic";

/**
 * Sign out.
 *
 * Does two things so logout is real, not cosmetic:
 *  1. clears the httpOnly session cookie, and
 *  2. records `sessionsRevokedAt` on the account so the (otherwise still
 *     valid) JWT is rejected by `getSession()` from this moment on.
 *
 * Note: this revokes every session for that account (all devices), which is
 * appropriate for a small ward console.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (session?.sub) {
      // Bump the session generation: every token issued before this moment is
      // now invalid, immediately and exactly. This also signs the user out on
      // any other device, which is the desired behaviour for a ward console.
      await db
        .update(officers)
        .set({
          sessionVersion: sql`${officers.sessionVersion} + 1`,
          sessionsRevokedAt: new Date(),
        })
        .where(eq(officers.id, session.sub));
    }
  } catch (err) {
    console.error("logout-revocation-failed", err);
  }

  const res = Response.json({ ok: true });
  // Attribute-for-attribute identical to the cookie set at login (same Path,
  // SameSite and Secure), otherwise the browser will not delete it.
  res.headers.append("Set-Cookie", clearSessionCookie(req));
  return res;
}
