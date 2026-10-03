"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Landmark,
  PlusCircle,
  Search,
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
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-6">
      {/* Top Header Row (Desktop + Mobile Logo & Desktop Nav) */}
      <div className="flex h-14 sm:h-16 items-center justify-between gap-2">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5 min-w-0">
          <span className="grid size-8 sm:size-10 shrink-0 place-items-center rounded-xl bg-ink text-cream shadow-card transition-transform group-hover:-rotate-6">
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
      </div>

      {/* Mobile Action Bar (Always visible on small screens with clean pills) */}
      <nav
        className="flex items-center justify-between gap-1.5 pb-2.5 pt-1 md:hidden overflow-x-auto no-scrollbar"
        aria-label="Mobile quick navigation"
      >
        <Link
          href="/complaint/new"
          className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
            pathname === "/complaint/new"
              ? "bg-saffron text-ink shadow-sm ring-2 ring-saffron/40"
              : "bg-saffron text-ink shadow-sm"
          }`}
        >
          <PlusCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>File</span>
        </Link>

        <Link
          href="/track"
          className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
            pathname === "/track"
              ? "border-saffron bg-paper-2 text-ink font-bold"
              : "border-line bg-paper text-ink"
          }`}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-ink" aria-hidden />
          <span>Track</span>
        </Link>

        {citizenSession ? (
          <Link
            href="/profile"
            className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-cream transition ${
              pathname === "/profile" ? "bg-ink" : "bg-flame"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Profile</span>
          </Link>
        ) : (
          <Link
            href="/login"
            className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-cream transition ${
              pathname === "/login" ? "bg-ink" : "bg-flame"
            }`}
          >
            <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Login</span>
          </Link>
        )}

        {!citizenSession && (
          <Link
            href="/register"
            className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-xl border border-flame px-2.5 py-2 text-xs font-semibold text-flame transition ${
              pathname === "/register" ? "bg-flame text-cream" : "bg-cream"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Reg</span>
          </Link>
        )}

        <Link
          href="/officer/login"
          className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-cream transition ${
            pathname?.startsWith("/officer") ? "ring-2 ring-saffron" : ""
          }`}
        >
          <UserRound className="h-3.5 w-3.5 shrink-0 text-saffron" aria-hidden />
          <span>Officer</span>
        </Link>
      </nav>
    </div>
  );
}
