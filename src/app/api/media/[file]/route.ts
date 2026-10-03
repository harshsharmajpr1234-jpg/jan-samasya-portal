import { db } from "@/db";
import { complaints } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canViewComplaint } from "@/lib/rbac";
import { verifyMediaToken } from "@/lib/media-token";
import { isSafeUploadName, mimeForUpload, readUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Restricted file access. Complaint photos are NOT public: a request succeeds
 * only for (a) a signed-in officer, or (b) a citizen presenting a short-lived
 * media token issued after verifying Tracking ID + mobile for the complaint
 * that owns this exact file.
 */
export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!isSafeUploadName(file)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [owner] = await db
    .select({ trackingId: complaints.trackingId, ward: complaints.ward })
    .from(complaints)
    .where(eq(complaints.photoPath, file))
    .limit(1);
  if (!owner) return Response.json({ error: "Not found" }, { status: 404 });

  const officer = await getSession();
  if (officer && !canViewComplaint(officer, { ward: owner.ward })) {
    // Ward scope applies to photo access too — not just to the records.
    return Response.json({ error: "Access denied" }, { status: 403 });
  }
  if (!officer) {
    const token = new URL(req.url).searchParams.get("mt") ?? "";
    const trackingId = token ? await verifyMediaToken(token) : null;
    if (!trackingId || trackingId !== owner.trackingId) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }
  }

  const data = await readUpload(file);
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeForUpload(file),
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'inline; filename="complaint-photo"',
    },
  });
}
