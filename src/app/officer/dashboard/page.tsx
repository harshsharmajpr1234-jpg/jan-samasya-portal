import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { areas, categories, complaints, officers } from "@/db/schema";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { visibleWards } from "@/lib/rbac";
import OfficerShell from "@/components/officer/OfficerShell";
import StatusBadge from "@/components/StatusBadge";
import { categoryIcon } from "@/lib/category-icons";
import { COMPLAINT_STATUSES, STATUS_LABEL, type ComplaintStatusValue } from "@/lib/constants";
import { getConfiguredWardNumbers } from "@/lib/wards";
import { Camera, Inbox, MapPin, Phone } from "lucide-react";

export const metadata: Metadata = {
  title: "Officer Dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function timeAgo(iso: Date): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  if (!session) redirect("/officer/login");

  const sp = await searchParams;
  const statusQ = one(sp.status) as ComplaintStatusValue | undefined;
  const wardQ = Number(one(sp.ward));
  const q = (one(sp.q) ?? "").trim();

  const wards = visibleWards(session);
  const configuredWards = await getConfiguredWardNumbers();
  const scope: SQL[] = [];
  if (wards !== null) {
    if (wards.length === 0) redirect("/officer/login");
    scope.push(eq(complaints.ward, wards[0]!));
  } else if (configuredWards.includes(wardQ)) {
    scope.push(eq(complaints.ward, wardQ));
  }

  const filter: SQL[] = [...scope];
  if (statusQ && COMPLAINT_STATUSES.includes(statusQ)) filter.push(eq(complaints.status, statusQ));
  if (q) filter.push(ilike(complaints.trackingId, `%${q.replace(/[%_]/g, "")}%`));

  const [items, statusCounts] = await Promise.all([
    db
      .select({
        id: complaints.id,
        trackingId: complaints.trackingId,
        citizenName: complaints.citizenName,
        citizenMobile: complaints.citizenMobile,
        ward: complaints.ward,
        status: complaints.status,
        createdAt: complaints.createdAt,
        photoPath: complaints.photoPath,
        lat: complaints.lat,
        areaName: areas.name,
        manualLocationText: complaints.manualLocationText,
        locationMethod: complaints.locationMethod,
        categoryNameEn: categories.nameEn,
        categoryNameHi: categories.nameHi,
        categorySlug: categories.slug,
        assignedOfficerName: officers.name,
      })
      .from(complaints)
      .leftJoin(areas, eq(complaints.areaId, areas.id))
      .innerJoin(categories, eq(complaints.categoryId, categories.id))
      .leftJoin(officers, eq(complaints.assignedOfficerId, officers.id))
      .where(and(...filter))
      .orderBy(desc(complaints.createdAt))
      .limit(60),
    db
      .select({ status: complaints.status, n: sql<number>`count(*)::int` })
      .from(complaints)
      .where(and(...scope))
      .groupBy(complaints.status),
  ]);
  const countOf = (s: ComplaintStatusValue) => statusCounts.find((r) => r.status === s)?.n ?? 0;

  const selectCls = "rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-saffron";

  return (
    <OfficerShell session={session} title={session.role === "admin" ? "All wards overview" : `Ward ${session.ward} complaints`}>
      {/* Status cards */}
      <div className="grid grid-cols-3 gap-3">
        {COMPLAINT_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/officer/dashboard?status=${s}${session.wardScope === "all" && configuredWards.includes(wardQ) ? `&ward=${wardQ}` : ""}`}
            className="card-hover rounded-2xl border border-line bg-cream p-4 shadow-card"
          >
            <StatusBadge status={s} />
            <p className="mt-2 font-display text-3xl font-extrabold">{countOf(s)}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-ink">{STATUS_LABEL[s]}</p>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <form method="get" className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-cream p-3 shadow-card">
        {session.wardScope === "all" && (
          <select name="ward" defaultValue={one(sp.ward) ?? ""} className={selectCls} aria-label="Filter by ward">
            <option value="">All wards</option>
            {configuredWards.map((w) => (
              <option key={w} value={w}>Ward {w}</option>
            ))}
          </select>
        )}
        <select name="status" defaultValue={statusQ ?? ""} className={selectCls} aria-label="Filter by status">
          <option value="">All statuses</option>
          {COMPLAINT_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search Tracking ID…"
          className="min-w-44 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-saffron"
        />
        <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-cream transition hover:bg-ink-2">
          Apply
        </button>
        <Link href="/officer/dashboard" className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-ink transition hover:text-flame">
          Reset
        </Link>
      </form>

      {/* List */}
      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-3xl border border-dashed border-line bg-cream/60 py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-ink" aria-hidden />
          <p className="mt-3 font-display text-lg font-bold">No complaints match</p>
          <p className="mt-1 text-sm text-muted-ink">Try clearing the filters above.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((c) => {
            const Icon = categoryIcon(c.categorySlug);
            return (
              <li key={c.id}>
                <Link
                  href={`/officer/complaints/${c.id}`}
                  className="card-hover flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-line bg-cream p-4 shadow-card sm:flex-nowrap"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-saffron">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-display text-sm font-extrabold tracking-wider text-flame">{c.trackingId}</p>
                      <StatusBadge status={c.status} />
                      {c.photoPath && <Camera className="h-3.5 w-3.5 text-muted-ink" aria-label="Has photo" />}
                      {c.lat !== null && <MapPin className="h-3.5 w-3.5 text-muted-ink" aria-label="Has GPS location" />}
                      {c.manualLocationText && (
                        <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-ink">
                          citizen location
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold">
                      {c.categoryNameHi} · <span className="font-normal text-muted-ink">{c.categoryNameEn}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-ink">
                      {c.ward !== null ? `Ward ${c.ward}` : "No ward"}
                      {c.areaName ? ` · ${c.areaName}` : ""}
                      {c.manualLocationText ? ` · ${c.manualLocationText}` : ""}
                      {" · "}
                      {timeAgo(c.createdAt)}
                      {c.assignedOfficerName ? ` · Assigned: ${c.assignedOfficerName}` : " · Unassigned"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-ink">
                    <p className="font-semibold text-ink">{c.citizenName}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1"><Phone className="h-3 w-3" aria-hidden /> {c.citizenMobile}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </OfficerShell>
  );
}
