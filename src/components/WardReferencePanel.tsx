import { db } from "@/db";
import { wardDelimitations, wardLocalities } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { BadgeCheck, BookMarked, TriangleAlert } from "lucide-react";
import { getConfiguredWardNumbers } from "@/lib/wards";
import type { WardDelimitation, WardLocality } from "@/db/schema";

/**
 * Ward reference data panel — keeps PUBLISHED SOURCE DATA visibly separate from
 * citizen complaints, and labels every delimitation with its year and its
 * verification status. Deliberately honest: nothing here is presented as
 * confirmed unless a source document actually confirms it.
 */
export default async function WardReferencePanel() {
  const wardNumbers = await getConfiguredWardNumbers();
  let delims: WardDelimitation[] = [];
  let localities: WardLocality[] = [];
  try {
    delims = await db.select().from(wardDelimitations).orderBy(asc(wardDelimitations.delimitationYear));
    localities = await db.select().from(wardLocalities).orderBy(asc(wardLocalities.ward), asc(wardLocalities.localityName));
  } catch {
    delims = [];
    localities = [];
  }

  return (
    <div className="mt-10 rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-8">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink text-saffron">
          <BookMarked className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h3 className="font-display text-xl font-bold tracking-tight">Ward reference data &amp; sources</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-ink">
            Ward / locality mappings are <strong>reference data</strong>, kept separate from citizen complaints.
            Each mapping records its source, publisher, delimitation and year, when it was checked, and whether
            that check succeeded.
          </p>
        </div>
      </div>

      {delims.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-paper p-4 text-sm text-muted-ink">
          No delimitation sources are recorded yet — run <code className="font-bold">npx tsx scripts/seed.ts</code>.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {delims.map((d) => {
            const verified = d.verificationStatus === "verified";
            const rows = localities.filter((l) => l.delimitationId === d.id);
            return (
              <li key={d.id} className="rounded-2xl border border-line bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-base font-bold leading-tight">{d.title}</p>
                    <p className="mt-1 text-xs text-muted-ink">
                      Delimitation: <strong className="text-ink">{d.delimitation}</strong> ({d.delimitationYear})
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      verified ? "bg-resolved-bg text-resolved" : "bg-pending-bg text-pending"
                    }`}
                  >
                    {verified ? <BadgeCheck className="h-3 w-3" aria-hidden /> : <TriangleAlert className="h-3 w-3" aria-hidden />}
                    {d.verificationStatus === "verified" ? "Verified" : "Needs verification"}
                  </span>
                </div>

                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 font-bold uppercase tracking-wider text-muted-ink">Publisher</dt>
                    <dd className="text-ink-2">{d.publisher}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 font-bold uppercase tracking-wider text-muted-ink">Source</dt>
                    <dd className="text-ink-2">
                      {d.source}
                      {d.sourceUrl && (
                        <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="ml-1 text-teal-civic hover:underline">
                          link
                        </a>
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 font-bold uppercase tracking-wider text-muted-ink">Checked</dt>
                    <dd className="text-ink-2">
                      {d.verifiedOn
                        ? new Date(d.verifiedOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : "not yet checked"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 font-bold uppercase tracking-wider text-muted-ink">Status</dt>
                    <dd className="text-ink-2">{d.isCurrent ? "Currently in force (if confirmed)" : "Historical / reference"}</dd>
                  </div>
                </dl>

                {d.notes && (
                  <p className="mt-3 rounded-xl bg-paper-2/70 p-3 text-[11px] leading-relaxed text-ink-2">{d.notes}</p>
                )}

                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-ink">
                    Ward {wardNumbers.join(" / ")} locality mappings for this delimitation
                  </p>
                  {rows.length === 0 ? (
                    <p className="mt-1.5 text-[11px] italic text-muted-ink">
                      None recorded — no locality list has been transcribed from this source yet. Marked{" "}
                      <strong>Needs verification</strong>; names are never guessed.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {wardNumbers.map((w) => (
                        <div key={w} className="w-full">
                          <p className="text-[11px] font-bold text-flame">Ward {w}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {rows
                              .filter((r) => r.ward === w)
                              .map((r) => (
                                <span
                                  key={r.id}
                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                    r.verificationStatus === "verified"
                                      ? "border-leaf/30 bg-resolved-bg text-resolved"
                                      : "border-line bg-cream text-muted-ink"
                                  }`}
                                  title={r.sourceRef ? `Source: ${r.sourceRef}` : "No source reference recorded"}
                                >
                                  {r.localityName}
                                </span>
                              ))}
                            {rows.filter((r) => r.ward === w).length === 0 && (
                              <span className="text-[11px] italic text-muted-ink">needs verification</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
