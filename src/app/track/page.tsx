import type { Metadata } from "next";
import { Suspense } from "react";
import TrackForm from "@/components/track/TrackForm";
import { Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Track a Complaint",
  description:
    "Securely track your Ward 12/13/14 complaint using your Tracking ID and registered mobile number. See live status, remarks and full audit history.",
};

export const dynamic = "force-dynamic";

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-muted-ink">
          <Search className="h-3.5 w-3.5 text-flame" aria-hidden />
          स्थिति जानें · Secure tracking
        </span>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Track your complaint
        </h1>
        <p className="mt-3 text-muted-ink">
          Enter your Tracking ID (like <code className="rounded bg-paper-2 px-1.5 py-0.5 text-xs font-bold text-ink">JSNM-12-KF4Q7X</code>)
          and the mobile number used while filing. Both are required — your complaint stays private to you.
        </p>
      </div>
      <Suspense fallback={<div className="mx-auto mt-10 h-72 max-w-xl animate-pulse rounded-3xl bg-paper-2" />}>
        <TrackForm />
      </Suspense>
    </div>
  );
}
