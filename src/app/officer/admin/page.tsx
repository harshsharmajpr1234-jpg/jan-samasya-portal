import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { areas, officers } from "@/db/schema";
import { asc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import OfficerShell from "@/components/officer/OfficerShell";
import AdminPanels from "@/components/officer/AdminPanels";
import WardReferencePanel from "@/components/WardReferencePanel";
import { getConfiguredWards } from "@/lib/wards";
import { ShieldCheck, UserRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/officer/login");
  if (session.role !== "admin") redirect("/officer/dashboard");

  const wardList = await getConfiguredWards();
  const [officerRows, areaRows] = await Promise.all([
    db
      .select({
        id: officers.id,
        name: officers.name,
        email: officers.email,
        role: officers.role,
        ward: officers.ward,
        active: officers.active,
        createdAt: officers.createdAt,
      })
      .from(officers)
      .orderBy(asc(officers.ward), asc(officers.name)),
    db.select().from(areas).orderBy(asc(areas.ward), asc(areas.name)),
  ]);

  return (
    <OfficerShell session={session} title="Administration">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Officers */}
        <section className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-7">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <ShieldCheck className="h-5 w-5 text-flame" aria-hidden /> Officer accounts
          </h2>
          <ul className="mt-4 space-y-2.5">
            {officerRows.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-ink text-saffron">
                    <UserRound className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{o.name}</p>
                    <p className="text-xs text-muted-ink">{o.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-flame">
                    {o.role === "admin" ? "Admin" : `Ward ${o.ward}`}
                  </p>
                  <p className={`text-[11px] font-semibold ${o.active ? "text-leaf" : "text-flame"}`}>
                    {o.active ? "Active" : "Disabled"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-ink">
            To disable an account, set <code className="rounded bg-paper-2 px-1 font-bold">active = false</code> in
            the database (see README — administration runbook).
          </p>
        </section>

        {/* Areas */}
        <section className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-7">
          <h2 className="font-display text-lg font-bold">Ward-wise areas</h2>
          <div className="mt-4 space-y-4">
            {wardList.map(({ number: w }) => (
              <div key={w}>
                <p className="text-xs font-bold uppercase tracking-wider text-flame">Ward {w}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {areaRows.filter((a) => a.ward === w).map((a) => (
                    <span
                      key={a.id}
                      title={`Verification: ${a.verificationStatus}${a.verificationNote ? ` — ${a.verificationNote}` : ""}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        a.verificationStatus === "verified"
                          ? "border-leaf/30 bg-resolved-bg text-resolved"
                          : "border-dashed border-line bg-paper text-muted-ink"
                      }`}
                    >
                      {a.name}
                      {a.verificationStatus !== "verified" && <span className="ml-1 text-[9px] font-bold uppercase">needs verif.</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <AdminPanels />

      {/* Ward reference data & sources — INTERNAL ONLY (admin console).
          Intentionally removed from the public website; kept here so the
          provenance records remain reviewable by administrators. */}
      <WardReferencePanel />
    </OfficerShell>
  );
}
