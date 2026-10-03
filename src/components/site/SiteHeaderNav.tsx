"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Landmark,
  Menu,
  X,
  PlusCircle,
  Search,
  Building2,
  UserCheck,
  UserRound,
  LogIn,
  UserPlus,
} from "lucide-react";
import { APP_NAME, APP_NAME_HI } from "@/lib/constants";
import type { CitizenSessionPayload } from "@/lib/jwt";

interface Props {
  wardLabel: string;
  citizenSession: CitizenSessionPayload | null;
}

export default function SiteHeaderNav({ wardLabel, citizenSession }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu whenever user navigates to a new page
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5 min-w-0">
          <span className="grid size-9 sm:size-10 shrink-0 place-items-center rounded-xl bg-ink text-cream shadow-card transition-transform group-hover:-rotate-6">
            <Landmark className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
          </span>
          <span className="leading-tight min-w-0 truncate">
            <span className="block font-hindi text-base sm:text-lg font-bold tracking-tight text-ink truncate">
              {APP_NAME_HI}
            </span>
            <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-ink truncate">
              {APP_NAME} · Wards {wardLabel}
            </span>
            <span className="block sm:hidden text-[9px] font-semibold uppercase tracking-wider text-muted-ink truncate">
              Wards {wardLabel}
            </span>
          </span>
        </Link>

        {/* Desktop Navigation */}
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

        {/* Mobile Action Controls */}
        <div className="flex items-center gap-1.5 md:hidden">
          <Link
            href="/complaint/new"
            className="inline-flex items-center gap-1 rounded-xl bg-saffron px-3 py-1.5 text-xs font-bold text-ink shadow-sm transition active:scale-95"
          >
            <PlusCircle className="h-3.5 w-3.5" aria-hidden />
            <span>File</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="grid size-9 place-items-center rounded-xl border border-line bg-paper text-ink transition active:bg-paper-2"
            aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[calc(4rem+1.75rem)] z-50 flex flex-col bg-paper/95 backdrop-blur-lg md:hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-ink">
              Navigation & Services
            </p>

            <div className="space-y-2">
              <Link
                href="/complaint/new"
                className="flex items-center gap-3.5 rounded-2xl bg-saffron/15 border border-saffron/30 p-3.5 text-sm font-bold text-ink transition active:scale-[0.99]"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-saffron text-ink">
                  <PlusCircle className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-bold">File a Complaint</div>
                  <div className="text-xs font-normal text-muted-ink">Register new problem with GPS & photo</div>
                </div>
              </Link>

              <Link
                href="/track"
                className="flex items-center gap-3.5 rounded-2xl bg-cream border border-line p-3.5 text-sm font-bold text-ink transition active:scale-[0.99]"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-ink/5 text-ink">
                  <Search className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-bold">Track Status</div>
                  <div className="text-xs font-normal text-muted-ink">Check progress using Tracking ID</div>
                </div>
              </Link>

              <Link
                href="/#wards"
                className="flex items-center gap-3.5 rounded-2xl bg-cream border border-line p-3.5 text-sm font-bold text-ink transition active:scale-[0.99]"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-ink/5 text-ink">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-bold">Our Wards</div>
                  <div className="text-xs font-normal text-muted-ink">Ward 12, 13 & 14 coverage scope</div>
                </div>
              </Link>
            </div>

            <p className="mb-3 mt-6 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-ink">
              Citizen Account
            </p>

            <div className="space-y-2">
              {citizenSession ? (
                <Link
                  href="/profile"
                  className="flex items-center gap-3.5 rounded-2xl bg-flame text-cream p-3.5 text-sm font-bold transition active:scale-[0.99]"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-cream/20 text-cream">
                    <UserCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-bold">{citizenSession.name}</div>
                    <div className="text-xs text-cream/80">{citizenSession.mobile} · View My Profile & Complaints</div>
                  </div>
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-2 rounded-2xl bg-flame px-4 py-3 text-sm font-bold text-cream transition active:scale-[0.98]"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Citizen Login</span>
                  </Link>

                  <Link
                    href="/register"
                    className="flex items-center justify-center gap-2 rounded-2xl border border-flame bg-cream px-4 py-3 text-sm font-bold text-flame transition active:scale-[0.98]"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Register</span>
                  </Link>
                </div>
              )}
            </div>

            <p className="mb-3 mt-6 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-ink">
              Officer Console
            </p>

            <Link
              href="/officer/login"
              className="flex items-center gap-3.5 rounded-2xl bg-ink text-cream p-3.5 text-sm font-bold transition active:scale-[0.99]"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-cream/10 text-saffron">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <div className="font-bold">Officer / Admin Login</div>
                <div className="text-xs text-cream/70">Authorized Ward Officers & Manch Admins only</div>
              </div>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
