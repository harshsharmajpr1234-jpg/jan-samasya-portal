import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import type { SessionPayload } from "@/lib/jwt";
import LogoutButton from "./LogoutButton";

/** Dark console header for authenticated officer pages. */
export default function OfficerShell({
  session,
  title,
  children,
}: {
  session: SessionPayload;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[70vh]">
      <div className="bg-ink bg-grid-dark text-cream">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-saffron">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {session.role === "admin" ? "Administrator" : `Ward ${session.ward} Officer`} console
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">{title}</h1>
            <p className="mt-0.5 text-xs text-cream/60">Signed in as {session.name} · {session.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/officer/dashboard" className="rounded-lg border border-cream/25 px-3 py-1.5 text-xs font-bold transition hover:bg-cream/10">
              Dashboard
            </Link>
            {session.role === "admin" && (
              <Link href="/officer/admin" className="rounded-lg bg-saffron px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-cream">
                Admin
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
