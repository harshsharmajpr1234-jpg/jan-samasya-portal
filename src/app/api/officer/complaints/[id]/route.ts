import { db } from "@/db";
import { areas, categories, complaintEvents, complaints, officers } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { requireOfficer } from "@/lib/auth";
import { canAssign, canUpdateComplaint, canViewComplaint } from "@/lib/rbac";
import { complaintPatchSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadComplaint(id: string) {
  const [row] = await db
    .select({
      complaint: complaints,
      areaName: areas.name,
      categoryNameEn: categories.nameEn,
      categoryNameHi: categories.nameHi,
      assignedOfficerName: officers.name,
    })
    .from(complaints)
    .leftJoin(areas, eq(complaints.areaId, areas.id))
    .innerJoin(categories, eq(complaints.categoryId, categories.id))
    .leftJoin(officers, eq(complaints.assignedOfficerId, officers.id))
    .where(eq(complaints.id, id))
    .limit(1);
  return row ?? null;
}

/** Officer-only: complaint detail with full audit history. */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireOfficer();
  if (!auth.ok) return auth.response;
  const { session } = auth;
  const { id } = await ctx.params;

  const row = await loadComplaint(id);
  if (!row) return Response.json({ error: "Complaint not found" }, { status: 404 });
  if (!canViewComplaint(session, row.complaint)) {
    return Response.json({ error: "You can only view complaints from your own ward" }, { status: 403 });
  }

  const events = await db
    .select()
    .from(complaintEvents)
    .where(eq(complaintEvents.complaintId, row.complaint.id))
    .orderBy(asc(complaintEvents.createdAt));

  // Officers that a complaint of this ward could be assigned to (admin only).
  const assignable =
    session.role === "admin" && row.complaint.ward !== null
      ? await db
          .select({ id: officers.id, name: officers.name })
          .from(officers)
          .where(and(eq(officers.role, "officer"), eq(officers.active, true), eq(officers.ward, row.complaint.ward)))
      : [];

  const c = row.complaint;
  return Response.json({
    complaint: {
      ...c,
      lat: c.lat === null ? null : Number(c.lat),
      lng: c.lng === null ? null : Number(c.lng),
      areaName: row.areaName,
      categoryNameEn: row.categoryNameEn,
      categoryNameHi: row.categoryNameHi,
      assignedOfficerName: row.assignedOfficerName,
    },
    events,
    assignableOfficers: assignable,
    photoUrl: c.photoPath ? `/api/media/${c.photoPath}` : null,
  });
}

/** Officer-only: update status, assign (admin), or add a remark. Audited. */
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireOfficer();
  if (!auth.ok) return auth.response;
  const { session } = auth;
  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = complaintPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const row = await loadComplaint(id);
  if (!row) return Response.json({ error: "Complaint not found" }, { status: 404 });
  const c = row.complaint;
  const actor = `${session.role === "admin" ? "Admin" : "Officer"}: ${session.name}`;

  const input = parsed.data;
  switch (input.action) {
    case "status": {
      if (!canUpdateComplaint(session, c)) {
        return Response.json({ error: "You can only update complaints from your own ward" }, { status: 403 });
      }
      if (c.status === "resolved" && session.role !== "admin") {
        return Response.json({ error: "Resolved complaints can only be reopened by an admin" }, { status: 409 });
      }
      if (input.toStatus === c.status) {
        return Response.json({ error: `Complaint is already ${input.toStatus}` }, { status: 409 });
      }
      const remark = (input.remark ?? "").trim();
      if (input.toStatus === "resolved" && remark.length === 0) {
        return Response.json({ error: "A resolution remark is required when marking resolved" }, { status: 400 });
      }
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(complaints)
          .set({
            status: input.toStatus,
            updatedAt: now,
            resolvedAt: input.toStatus === "resolved" ? now : c.resolvedAt,
          })
          .where(eq(complaints.id, c.id));
        await tx.insert(complaintEvents).values({
          complaintId: c.id,
          type: "status_changed",
          actorLabel: actor,
          actorOfficerId: session.sub,
          fromStatus: c.status,
          toStatus: input.toStatus,
          remark: remark || null,
          isPublic: input.isPublic ?? true,
        });
      });
      return Response.json({ ok: true, status: input.toStatus });
    }

    case "assign": {
      if (!canAssign(session)) {
        return Response.json({ error: "Only admins can assign complaints" }, { status: 403 });
      }
      const [target] = await db
        .select()
        .from(officers)
        .where(
          and(eq(officers.id, input.officerId), eq(officers.role, "officer"), eq(officers.active, true)),
        )
        .limit(1);
      if (!target) return Response.json({ error: "Officer not found or inactive" }, { status: 404 });
      if (target.ward !== c.ward) {
        return Response.json({ error: `Officer belongs to Ward ${target.ward}; complaint is in Ward ${c.ward}` }, { status: 400 });
      }
      await db.transaction(async (tx) => {
        await tx
          .update(complaints)
          .set({ assignedOfficerId: target.id, updatedAt: new Date() })
          .where(eq(complaints.id, c.id));
        await tx.insert(complaintEvents).values({
          complaintId: c.id,
          type: "assigned",
          actorLabel: actor,
          actorOfficerId: session.sub,
          remark: `Assigned to ${target.name}`,
          isPublic: false,
        });
      });
      return Response.json({ ok: true, assignedOfficerName: target.name });
    }

    case "remark": {
      if (!canUpdateComplaint(session, c)) {
        return Response.json({ error: "You can only remark on complaints from your own ward" }, { status: 403 });
      }
      await db.transaction(async (tx) => {
        await tx.update(complaints).set({ updatedAt: new Date() }).where(eq(complaints.id, c.id));
        await tx.insert(complaintEvents).values({
          complaintId: c.id,
          type: "remark_added",
          actorLabel: actor,
          actorOfficerId: session.sub,
          remark: input.text,
          isPublic: input.isPublic ?? true,
        });
      });
      return Response.json({ ok: true });
    }
  }
}


