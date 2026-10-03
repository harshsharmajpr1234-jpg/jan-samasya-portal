import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { areas, categories, complaintEvents, complaints, officers } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canViewComplaint } from "@/lib/rbac";
import OfficerShell from "@/components/officer/OfficerShell";
import StatusBadge from "@/components/StatusBadge";
import ComplaintActions from "@/components/officer/ComplaintActions";
import LeafletReadOnly from "@/components/map/LeafletReadOnly";
import { categoryIcon } from "@/lib/category-icons";
import { ArrowLeft, BadgeCheck, EyeOff, FileText, MapPin, MessageSquareQuote, Phone, UserRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Complaint Detail",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const fmt = (d: Date) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/officer/login");
  const { id } = await params;

  const [row] = await db
    .select({
      complaint: complaints,
      areaName: areas.name,
      categoryNameEn: categories.nameEn,
      categoryNameHi: categories.nameHi,
      categorySlug: categories.slug,
      assignedOfficerName: officers.name,
    })
    .from(complaints)
    .leftJoin(areas, eq(complaints.areaId, areas.id))
    .innerJoin(categories, eq(complaints.categoryId, categories.id))
    .leftJoin(officers, eq(complaints.assignedOfficerId, officers.id))
    .where(eq(complaints.id, id))
    .limit(1);

  if (!row) notFound();
  if (!canViewComplaint(session, row.complaint)) {
    return (
      <OfficerShell session={session} title="Access restricted">
        <div className="rounded-3xl border border-flame/40 bg-flame/10 p-8 text-center">
          <p className="font-display text-xl font-bold">This complaint belongs to Ward {row.complaint.ward}</p>
          <p className="mt-2 text-sm text-muted-ink">
            Role-based access: ward officers can only open complaints from their own ward.
          </p>
          <Link href="/officer/dashboard" className="mt-4 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-cream">
            Back to your dashboard
          </Link>
        </div>
      </OfficerShell>
    );
  }

  const c = row.complaint;
  const [events, assignable] = await Promise.all([
    db.select().from(complaintEvents).where(eq(complaintEvents.complaintId, c.id)).orderBy(asc(complaintEvents.createdAt)),
    session.role === "admin" && c.ward !== null
      ? db
          .select({ id: officers.id, name: officers.name })
          .from(officers)
          .where(and(eq(officers.role, "officer"), eq(officers.active, true), eq(officers.ward, c.ward)))
      : Promise.resolve([]),
  ]);

  const iconElement = React.createElement(categoryIcon(row.categorySlug), {
    className: "h-6 w-6",
    "aria-hidden": true,
  });
  const lat = c.lat === null ? null : Number(c.lat);
  const lng = c.lng === null ? null : Number(c.lng);

  return (
    <OfficerShell session={session} title={c.trackingId}>
      <Link href="/officer/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-ink transition hover:text-flame">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to list
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* ---------- Details ---------- */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-ink text-saffron">
                  {iconElement}
                </span>
                <div>
                  <p className="font-hindi text-lg font-bold leading-tight">{row.categoryNameHi}</p>
                  <p className="text-xs text-muted-ink">{row.categoryNameEn}</p>
                </div>
              </div>
              <StatusBadge status={c.status} />
            </div>

            <p className="mt-5 rounded-2xl bg-paper p-4 text-sm leading-relaxed text-ink-2">{c.description}</p>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-ink">Ward · Area</dt>
                <dd className="mt-0.5 font-semibold">
                  {c.ward !== null ? `Ward ${c.ward}` : "Ward not selected"}
                  {row.areaName ? ` · ${row.areaName}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-ink">Filed on</dt>
                <dd className="mt-0.5 font-semibold">{fmt(c.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-ink">Last update</dt>
                <dd className="mt-0.5 font-semibold">{fmt(c.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-ink">Citizen</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 font-semibold"><UserRound className="h-3.5 w-3.5 text-muted-ink" aria-hidden /> {c.citizenName}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-ink">Mobile</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 font-semibold"><Phone className="h-3.5 w-3.5 text-muted-ink" aria-hidden /> +91 {c.citizenMobile}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-ink">Assigned to</dt>
                <dd className="mt-0.5 font-semibold">{row.assignedOfficerName ?? "— unassigned —"}</dd>
              </div>
            </dl>
            {/* ---- Location block: keeps every supplied method visible ---- */}
            <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-ink">Location information</p>
                {c.locationMethod && (
                  <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-saffron">
                    {c.locationMethod.replace("_", " + ")}
                  </span>
                )}
              </div>
              <ul className="mt-2.5 space-y-1.5 text-sm">
                {row.areaName && (
                  <li className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-flame" aria-hidden />
                    <span><strong className="font-semibold">Selected area:</strong> {row.areaName}</span>
                  </li>
                )}
                {c.manualLocationText && (
                  <li className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-flame" aria-hidden />
                    <span>
                      <strong className="font-semibold">Citizen-provided location:</strong> {c.manualLocationText}
                    </span>
                  </li>
                )}
                {c.addressText && (
                  <li className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-ink" aria-hidden />
                    <span><strong className="font-semibold">Landmark:</strong> {c.addressText}</span>
                  </li>
                )}
                {lat !== null && lng !== null && (
                  <li className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-civic" aria-hidden />
                    <span><strong className="font-semibold">GPS:</strong> {lat.toFixed(5)}, {lng.toFixed(5)}</span>
                  </li>
                )}
                {!row.areaName && !c.manualLocationText && !c.addressText && lat === null && (
                  <li className="text-muted-ink">No location details were supplied by the citizen.</li>
                )}
              </ul>
            </div>
          </div>

          {c.photoPath && (
            <figure className="overflow-hidden rounded-3xl border border-line bg-cream shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media/${c.photoPath}`} alt="Citizen-submitted complaint photo" className="max-h-[420px] w-full object-cover" />
              <figcaption className="px-4 py-2 text-[11px] text-muted-ink">Citizen-submitted photo (restricted access)</figcaption>
            </figure>
          )}

          {lat !== null && lng !== null && (
            <div className="rounded-3xl border border-line bg-cream p-4 shadow-card">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-ink">
                <MapPin className="h-4 w-4 text-flame" aria-hidden /> Reported location · {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
              <LeafletReadOnly lat={lat} lng={lng} />
              <a
                href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-bold text-teal-civic hover:underline"
              >
                Open in OpenStreetMap →
              </a>
            </div>
          )}
        </div>

        {/* ---------- Actions + audit ---------- */}
        <div className="space-y-6">
          <ComplaintActions
            complaintId={c.id}
            currentStatus={c.status}
            isAdmin={session.role === "admin"}
            assignableOfficers={assignable}
            assignedOfficerId={c.assignedOfficerId}
          />

          <div className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-7">
            <h2 className="font-display text-lg font-bold">Audit history</h2>
            <p className="text-xs text-muted-ink">Append-only record — entries are never edited or deleted.</p>
            <ol className="mt-5 space-y-0">
              {[...events].reverse().map((ev, i) => (
                <li key={ev.id} className="relative flex gap-3.5 pb-6 last:pb-0">
                  {i < events.length - 1 && <span className="absolute left-[15px] top-8 h-full w-0.5 bg-line" aria-hidden />}
                  <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-ink text-saffron">
                    {ev.type === "created" ? (
                      <FileText className="h-4 w-4" aria-hidden />
                    ) : ev.type === "remark_added" ? (
                      <MessageSquareQuote className="h-4 w-4" aria-hidden />
                    ) : (
                      <BadgeCheck className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-bold">
                        {ev.type === "created"
                          ? "Complaint registered"
                          : ev.type === "status_changed"
                            ? `Status: ${ev.fromStatus?.replace("_", " ")} → ${ev.toStatus?.replace("_", " ")}`
                            : ev.type === "assigned"
                              ? "Assignment"
                              : "Remark"}
                      </p>
                      {!ev.isPublic && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-muted-ink">
                          <EyeOff className="h-3 w-3" aria-hidden /> internal
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-ink">{ev.actorLabel} · {fmt(ev.createdAt)}</p>
                    {ev.remark && <p className="mt-1.5 rounded-lg bg-paper px-3 py-2 text-sm text-ink-2">{ev.remark}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </OfficerShell>
  );
}
