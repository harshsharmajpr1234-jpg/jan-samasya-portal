import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { categories, complaints } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import { getCitizenSession } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import { ArrowRight, FileText, LogOut, PlusCircle, UserRound } from "lucide-react";
import CitizenLogoutButton from "@/components/site/CitizenLogoutButton";

export const dynamic = "force-dynamic";

const fmt = (d: Date) =>
  new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function CitizenProfilePage() {
  const session = await getCitizenSession();
  if (!session) redirect("/login?redirect=/profile");

  const myComplaints = await db
    .select({
      complaint: complaints,
      categoryNameEn: categories.nameEn,
      categoryNameHi: categories.nameHi,
    })
    .from(complaints)
    .innerJoin(categories, eq(complaints.categoryId, categories.id))
    .where(
      or(
        eq(complaints.citizenId, session.sub),
        eq(complaints.citizenMobile, session.mobile),
      ),
    )
    .orderBy(desc(complaints.createdAt));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Header Profile Card */}
      <div className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-ink text-saffron">
              <UserRound className="h-7 w-7" aria-hidden />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold">{session.name}</h1>
              <p className="text-sm font-semibold text-muted-ink">+91 {session.mobile}</p>
              {session.email && <p className="text-xs text-muted-ink">{session.email}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/complaint/new"
              className="inline-flex items-center gap-2 rounded-xl bg-flame px-5 py-3 font-display text-sm font-bold text-cream transition hover:bg-ink"
            >
              <PlusCircle className="h-4 w-4" aria-hidden />
              File New Complaint
            </Link>
            <CitizenLogoutButton />
          </div>
        </div>
      </div>

      {/* Complaints Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">My Filed Complaints ({myComplaints.length})</h2>
          <p className="text-xs text-muted-ink">Ward 12 · 13 · 14 grievance records</p>
        </div>

        {myComplaints.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-line bg-paper p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-ink" aria-hidden />
            <h3 className="mt-3 font-display text-lg font-bold">No complaints registered yet</h3>
            <p className="mt-1 text-sm text-muted-ink">
              You haven&apos;t submitted any grievances with this account yet.
            </p>
            <Link
              href="/complaint/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 font-display text-sm font-bold text-cream transition hover:bg-ink-2"
            >
              File your first complaint
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {myComplaints.map(({ complaint: c, categoryNameEn, categoryNameHi }) => (
              <div key={c.id} className="rounded-2xl border border-line bg-cream p-5 shadow-card transition hover:border-saffron/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="font-display text-sm font-extrabold tracking-wider text-flame">{c.trackingId}</span>
                    <h3 className="font-hindi text-lg font-bold leading-snug">
                      {categoryNameHi} <span className="text-xs font-normal text-muted-ink">({categoryNameEn})</span>
                    </h3>
                    <p className="mt-1 text-xs text-muted-ink">
                      {c.ward !== null ? `Ward ${c.ward}` : "Ward not selected"}
                      {c.manualLocationText ? ` · ${c.manualLocationText}` : ""}
                    </p>
                    {c.landmarkText && (
                      <p className="mt-0.5 text-xs text-muted-ink">
                        Landmark: <strong>{c.landmarkText}</strong>
                      </p>
                    )}
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <p className="mt-3 rounded-xl bg-paper p-3 text-sm leading-relaxed text-ink-2">
                  {c.description}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-line/60 pt-3 text-muted-ink">
                  <span>Filed on {fmt(c.createdAt)}</span>
                  <Link
                    href={`/track?id=${c.trackingId}`}
                    className="inline-flex items-center gap-1 font-bold text-flame hover:underline"
                  >
                    Track Progress →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
