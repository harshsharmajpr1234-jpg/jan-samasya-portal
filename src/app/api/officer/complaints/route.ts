import { db } from "@/db";
import { areas, categories, complaints, officers } from "@/db/schema";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { requireOfficer } from "@/lib/auth";
import { officerListQuerySchema } from "@/lib/validators";
import { visibleWards } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Officer-only: paginated complaint list, restricted by ward via RBAC. */
export async function GET(req: Request) {
  const auth = await requireOfficer();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { searchParams } = new URL(req.url);
  const parsed = officerListQuerySchema.safeParse({
    ward: searchParams.get("ward") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "Invalid filters" }, { status: 400 });
  }
  const q = parsed.data;

  const conditions: SQL[] = [];
  const wards = visibleWards(session);
  if (wards !== null) {
    if (wards.length === 0) return Response.json({ items: [], total: 0, page: q.page, limit: q.limit });
    conditions.push(eq(complaints.ward, wards[0]!));
  } else if (q.ward !== undefined) {
    conditions.push(eq(complaints.ward, q.ward));
  }
  if (q.status) conditions.push(eq(complaints.status, q.status));
  if (q.categoryId) conditions.push(eq(complaints.categoryId, q.categoryId));
  if (q.q) {
    const like = `%${q.q.replace(/[%_]/g, "")}%`;
    conditions.push(
      or(ilike(complaints.trackingId, like), ilike(complaints.citizenName, like), ilike(complaints.citizenMobile, like))!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [items, [countRow]] = await Promise.all([
    db
      .select({
        id: complaints.id,
        trackingId: complaints.trackingId,
        citizenName: complaints.citizenName,
        ward: complaints.ward,
        status: complaints.status,
        description: complaints.description,
        hasPhoto: sql<boolean>`${complaints.photoPath} is not null`,
        hasLocation: sql<boolean>`${complaints.lat} is not null`,
        manualLocationText: complaints.manualLocationText,
        locationMethod: complaints.locationMethod,
        createdAt: complaints.createdAt,
        updatedAt: complaints.updatedAt,
        areaName: areas.name,
        categoryNameEn: categories.nameEn,
        categoryNameHi: categories.nameHi,
        assignedOfficerName: officers.name,
      })
      .from(complaints)
      .leftJoin(areas, eq(complaints.areaId, areas.id))
      .innerJoin(categories, eq(complaints.categoryId, categories.id))
      .leftJoin(officers, eq(complaints.assignedOfficerId, officers.id))
      .where(where)
      .orderBy(desc(complaints.createdAt))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit),
    db.select({ total: sql<number>`count(*)::int` }).from(complaints).where(where),
  ]);

  return Response.json({ items, total: countRow?.total ?? 0, page: q.page, limit: q.limit });
}
