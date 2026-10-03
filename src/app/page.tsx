import Link from "next/link";
import Image from "next/image";
import { db } from "@/db";
import { categories, citizens, complaints } from "@/db/schema";
import { asc, count, eq, sql } from "drizzle-orm";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  ClipboardList,
  FileText,
  History,
  MapPin,
  Search,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import Reveal from "@/components/Reveal";
import StatNumber from "@/components/StatNumber";

import { categoryIcon } from "@/lib/category-icons";
import { getConfiguredWards } from "@/lib/wards";

export const dynamic = "force-dynamic";

async function getStats() {
  try {
    const [[complaintTotals], [citizenTotals], wardRows] = await Promise.all([
      db
        .select({
          total: count(),
          resolved: sql<number>`count(*) filter (where ${complaints.status} = 'resolved')::int`,
          inProgress: sql<number>`count(*) filter (where ${complaints.status} = 'in_progress')::int`,
        })
        .from(complaints),
      db
        .select({
          totalCitizens: count(),
        })
        .from(citizens),
      db
        .select({
          ward: complaints.ward,
          total: count(),
          resolved: sql<number>`count(*) filter (where ${complaints.status} = 'resolved')::int`,
        })
        .from(complaints)
        .groupBy(complaints.ward),
    ]);

    return {
      totals: {
        totalComplaints: complaintTotals?.total ?? 0,
        resolved: complaintTotals?.resolved ?? 0,
        inProgress: complaintTotals?.inProgress ?? 0,
        registeredCitizens: citizenTotals?.totalCitizens ?? 0,
      },
      wardRows,
    };
  } catch {
    return {
      totals: { totalComplaints: 0, resolved: 0, inProgress: 0, registeredCitizens: 0 },
      wardRows: [],
    };
  }
}

async function getCategories() {
  try {
    return await db
      .select()
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.sortOrder));
  } catch {
    return [];
  }
}

const STEPS = [
  {
    icon: FileText,
    title: "Describe the problem",
    hi: "समस्या लिखें",
    body: "Pick your ward, area and category. Add a photo and drop a pin on the map. Your mobile number becomes your private tracking key.",
  },
  {
    icon: Smartphone,
    title: "Get a Tracking ID",
    hi: "ट्रैकिंग आईडी पाएं",
    body: "Every complaint receives a unique ID like JSNM-12-KF4Q7X. Note it down — it is yours instantly, no account or app needed.",
  },
  {
    icon: History,
    title: "Follow every step",
    hi: "हर अपडेट देखें",
    body: "Ward officers update status — pending, in progress, resolved — with dated remarks. The full audit history is visible to you.",
  },
];

export default async function HomePage() {
  const [{ totals, wardRows }, catRows, wardList] = await Promise.all([
    getStats(),
    getCategories(),
    getConfiguredWards(),
  ]);
  const wardTotal = new Map(wardRows.map((w) => [w.ward, w]));

  return (
    <div>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 size-[480px] rounded-full bg-saffron/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 bottom-0 size-[420px] rounded-full bg-teal-civic/10 blur-3xl" />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-muted-ink">
                <span className="size-1.5 rounded-full bg-leaf" />
                For Ward 12 · Ward 13 · Ward 14 only
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-6 font-hindi text-[clamp(2.6rem,6.5vw,4.6rem)] font-extrabold leading-[1.04] tracking-tight">
                आपकी समस्या,
                <br />
                <span className="relative inline-block text-flame">
                  हमारी ज़िम्मेदारी
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none" aria-hidden>
                    <path d="M2 9C60 3 180 2 298 7" stroke="var(--color-saffron)" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-ink">
                <span className="font-display font-semibold text-ink">Jan Samasya Nivaran Manch</span> is an
                independent, citizen-run grievance portal. Report garbage, water, road, streetlight and drainage
                problems in your ward — with a photo and map pin — and follow every action transparently.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/complaint/new"
                  className="group inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3.5 font-display text-sm font-semibold text-cream shadow-lift transition hover:bg-ink-2"
                >
                  File a Complaint
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
                <Link
                  href="/track"
                  className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-cream px-6 py-3.5 font-display text-sm font-semibold text-ink transition hover:border-saffron hover:bg-paper-2"
                >
                  <Search className="h-4 w-4" aria-hidden />
                  Track Complaint
                </Link>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-muted-ink">
                <span className="inline-flex items-center gap-1.5"><Camera className="h-3.5 w-3.5 text-flame" aria-hidden /> Photo + GPS pin</span>
                <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-leaf" aria-hidden /> Unique tracking ID</span>
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-teal-civic" aria-hidden /> OpenStreetMap — free forever</span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={200} className="relative">
            <div className="relative overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br from-paper via-cream to-paper-2 shadow-lift">
              <Image
                src="/images/hero-civic.jpg"
                alt="Illustration of neighbours and civic workers improving a ward together"
                width={1024}
                height={768}
                priority
                className="relative h-[360px] w-full object-cover sm:h-[420px]"
              />
              {/* Floating live counters */}
              <div className="absolute -left-3 top-6 animate-float rounded-2xl border border-line bg-cream/95 px-4 py-3 shadow-lift backdrop-blur sm:-left-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-ink">Complaints resolved</p>
                <p className="font-display text-2xl font-bold text-leaf">
                  <StatNumber value={totals?.resolved ?? 0} />
                </p>
              </div>
              <div
                className="absolute -bottom-5 right-4 animate-float rounded-2xl border border-line bg-ink px-4 py-3 text-cream shadow-lift"
                style={{ animationDelay: "1.4s" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cream/60">Registered Citizens</p>
                <p className="font-display text-2xl font-bold text-saffron">
                  <StatNumber value={totals?.registeredCitizens ?? 0} />
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ LIVE COUNTER STRIP ============ */}
      <section className="border-y border-ink/10 bg-ink bg-grid-dark text-cream">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-cream/10 px-4 sm:px-6 md:grid-cols-4">
          {[
            { label: "पंजीकृत नागरिक · Citizens", value: totals?.registeredCitizens ?? 0 },
            { label: "कुल शिकायतें · Total Filed", value: totals?.totalComplaints ?? 0 },
            { label: "प्रगति में · In Progress", value: totals?.inProgress ?? 0 },
            { label: "सुलझी · Resolved", value: totals?.resolved ?? 0 },
          ].map((s) => (
            <div key={s.label} className="px-5 py-7 text-center">
              <p className="font-display text-3xl font-bold text-saffron">
                <StatNumber value={Math.max(0, s.value)} />
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/60">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-20 sm:px-6">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-flame">कैसे काम करता है</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Three steps. Zero cost. Full transparency.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 120}>
              <article className="card-hover relative h-full overflow-hidden rounded-3xl border border-line bg-cream p-7 shadow-card">
                <span className="absolute -right-3 -top-5 font-display text-[88px] font-extrabold text-paper-2 select-none" aria-hidden>
                  {i + 1}
                </span>
                <span className="relative grid size-12 place-items-center rounded-2xl bg-ink text-saffron">
                  <step.icon className="h-6 w-6" aria-hidden />
                </span>
                <p className="relative mt-3 font-hindi text-sm font-semibold text-muted-ink">{step.hi}</p>
                <h3 className="relative mt-1 font-display text-xl font-bold">{step.title}</h3>
                <p className="relative mt-3 text-sm leading-relaxed text-muted-ink">{step.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ WARDS ============ */}
      <section id="wards" className="scroll-mt-28 border-y border-ink/10 bg-paper-2/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-flame">हमारे वार्ड</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Ward-wise coverage &amp; areas
            </h2>
            <p className="mt-3 max-w-2xl text-muted-ink">
              The manch serves exactly three wards. Select your ward when filing — complaints are routed only to
              that ward&apos;s officers, and every ward&apos;s progress is counted separately.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {wardList.map(({ number: ward }, i) => {
              const stat = wardTotal.get(ward);
              return (
                <Reveal key={ward} delay={i * 120}>
                  <article className="card-hover flex h-full flex-col rounded-3xl border border-line bg-cream p-7 shadow-card">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-hindi text-sm font-semibold text-muted-ink">वार्ड क्रमांक</p>
                        <h3 className="font-display text-4xl font-extrabold tracking-tight text-ink">
                          Ward {ward}
                        </h3>
                      </div>
                      <span className="grid size-12 place-items-center rounded-2xl bg-saffron/15 font-display text-lg font-extrabold text-flame">
                        {ward}
                      </span>
                    </div>
                    <div className="mt-4 flex gap-4 text-center">
                      <div className="flex-1 rounded-xl bg-paper-2 px-3 py-2.5">
                        <p className="font-display text-xl font-bold">{stat?.total ?? 0}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-ink">Filed</p>
                      </div>
                      <div className="flex-1 rounded-xl bg-resolved-bg px-3 py-2.5">
                        <p className="font-display text-xl font-bold text-resolved">{stat?.resolved ?? 0}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-resolved">Resolved</p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-1">
                      <p className="rounded-xl border border-dashed border-line bg-paper px-3 py-2.5 text-xs leading-relaxed text-muted-ink">
                        Area list is being verified. You can enter your colony or problem location while filing a
                        complaint.
                      </p>
                    </div>
                    <Link
                      href={`/complaint/new?ward=${ward}`}
                      className="group mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-flame"
                    >
                      File for Ward {ward}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                    </Link>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ CATEGORIES ============ */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-flame">समस्या श्रेणियाँ</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">What you can report</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {catRows.map((cat, i) => {
            const Icon = categoryIcon(cat.slug);
            return (
              <Reveal key={cat.id} delay={(i % 4) * 80}>
                <Link
                  href={`/complaint/new?category=${cat.slug}`}
                  className="card-hover group flex h-full flex-col items-start rounded-2xl border border-line bg-cream p-5 shadow-card"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-ink text-saffron transition-colors group-hover:bg-flame group-hover:text-cream">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="mt-3 font-hindi text-sm font-semibold leading-snug">{cat.nameHi}</p>
                  <p className="mt-0.5 text-xs text-muted-ink">{cat.nameEn}</p>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ============ TRANSPARENCY ============ */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Reveal>
            <div className="h-full rounded-3xl bg-ink bg-grid-dark p-8 text-cream shadow-lift sm:p-10">
              <ClipboardList className="h-8 w-8 text-saffron" aria-hidden />
              <h3 className="mt-4 font-display text-2xl font-bold sm:text-3xl">Every action leaves a trail</h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-cream/70">
                Status changes, officer assignments and remarks are written to an append-only audit history the
                moment they happen. When you track your complaint you see the same dated timeline our officers do
                — nothing is edited after the fact.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { k: "Pending", v: "Received & queued", c: "text-pending bg-pending-bg" },
                  { k: "In Progress", v: "Officer is on it", c: "text-progress bg-progress-bg" },
                  { k: "Resolved", v: "Work completed", c: "text-resolved bg-resolved-bg" },
                ].map((s) => (
                  <div key={s.k} className="rounded-2xl border border-cream/10 bg-cream/5 p-4">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${s.c}`}>
                      {s.k}
                    </span>
                    <p className="mt-2 text-xs text-cream/60">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="flex h-full flex-col rounded-3xl border border-flame/30 bg-flame/5 p-8 shadow-card">
              <ShieldAlert className="h-8 w-8 text-flame" aria-hidden />
              <h3 className="mt-4 font-display text-xl font-bold">Honest by design</h3>
              <ul className="mt-4 flex-1 space-y-3 text-sm leading-relaxed text-ink-2">
                <li className="flex gap-2"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-flame" /> Independent citizen portal — <strong>not</strong> a government or Nagar Nigam website.</li>
                <li className="flex gap-2"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-flame" /> No integration with any official system is claimed or implied.</li>
                <li className="flex gap-2"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-flame" /> Your mobile number is used only for complaint tracking — never sold or shared.</li>
                <li className="flex gap-2"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-flame" /> Maps by OpenStreetMap; no paid APIs anywhere in the stack.</li>
              </ul>
              <Link
                href="/complaint/new"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-flame px-5 py-3 font-display text-sm font-semibold text-cream transition hover:bg-ink"
              >
                Raise your voice — it&apos;s free
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
