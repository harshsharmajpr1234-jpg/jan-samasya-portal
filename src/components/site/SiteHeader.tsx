import Link from "next/link";
import { Landmark, ShieldAlert, UserCheck, UserRound } from "lucide-react";
import { APP_NAME, APP_NAME_HI } from "@/lib/constants";
import { getConfiguredWardNumbers } from "@/lib/wards";
import { getCitizenSession } from "@/lib/auth";

export default async function SiteHeader() {
  const [wardNumbers, citizenSession] = await Promise.all([
    getConfiguredWardNumbers(),
    getCitizenSession(),
  ]);
  const wardLabel = wardNumbers.length > 0 ? wardNumbers.join(" · ") : "ward setup pending";

  return (
    <header className="sticky top-0 z-40">
      {/* Independence notice — always visible, by design */}
      <div className="flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-cream/90 sm:text-xs">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-saffron" aria-hidden />
        <span>
          Independent citizen portal — not an official government / Nagar Nigam website · केवल पंजीकृत वार्डों हेतु
        </span>
      </div>

      <div className="border-b border-line bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-ink text-cream shadow-card transition-transform group-hover:-rotate-6">
              <Landmark className="h-5 w-5" aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block font-hindi text-lg font-bold tracking-tight">{APP_NAME_HI}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-ink">
                {APP_NAME} · Wards {wardLabel}
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-semibold md:flex" aria-label="Primary">
            <Link href="/complaint/new" className="rounded-lg px-3 py-2 text-ink-2 transition hover:bg-paper-2">
              File Complaint
            </Link>
            <Link href="/track" className="rounded-lg px-3 py-2 text-ink-2 transition hover:bg-paper-2">
              Track Status
            </Link>
            <Link href="/#wards" className="rounded-lg px-3 py-2 text-ink-2 transition hover:bg-paper-2">
              Our Wards
            </Link>

            {citizenSession ? (
              <Link
                href="/profile"
                className="ml-2 inline-flex items-center gap-2 rounded-lg bg-flame px-4 py-2 text-cream transition hover:bg-ink"
              >
                <UserCheck className="h-4 w-4" aria-hidden />
                {citizenSession.name.split(" ")[0]} (My Profile)
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-flame transition hover:bg-paper-2">
                  Citizen Login
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg border border-flame px-3.5 py-1.5 text-flame transition hover:bg-flame hover:text-cream"
                >
                  Register
                </Link>
              </>
            )}

            <Link
              href="/officer/login"
              className="ml-2 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-cream transition hover:bg-ink-2"
            >
              <UserRound className="h-4 w-4" aria-hidden />
              Officer Login
            </Link>
          </nav>

          {/* Compact nav for small screens */}
          <nav className="flex items-center gap-1 text-xs font-semibold md:hidden" aria-label="Primary mobile">
            <Link href="/complaint/new" className="rounded-lg bg-saffron px-3 py-2 text-ink">
              File
            </Link>
            <Link href="/track" className="rounded-lg bg-paper-2 px-3 py-2 text-ink">
              Track
            </Link>
            {citizenSession ? (
              <Link href="/profile" className="rounded-lg bg-flame px-3 py-2 text-cream">
                Profile
              </Link>
            ) : (
              <Link href="/login" className="rounded-lg bg-flame px-3 py-2 text-cream">
                Login
              </Link>
            )}
            <Link href="/officer/login" className="rounded-lg bg-ink px-3 py-2 text-cream">
              Officer
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
