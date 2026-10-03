import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCitizenSession } from "@/lib/auth";
import ComplaintForm from "@/components/complaint/ComplaintForm";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "File a Complaint",
  description:
    "Register a civic complaint for Ward 12, 13 or 14 — choose category, add photo and map location, and receive a unique tracking ID instantly.",
};

export const dynamic = "force-dynamic";

export default async function NewComplaintPage() {
  const session = await getCitizenSession();
  if (!session) {
    redirect("/login?redirect=/complaint/new");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-muted-ink">
          <FileText className="h-3.5 w-3.5 text-flame" aria-hidden />
          शिकायत दर्ज करें · Free &amp; independent
        </span>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          File a complaint
        </h1>
        <p className="mt-3 text-muted-ink">
          Welcome, <strong>{session.name}</strong> (+91 {session.mobile}). Only <strong>Ward 12, Ward 13 and Ward 14</strong> are served.
        </p>
      </div>
      <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-4xl animate-pulse rounded-3xl bg-paper-2" />}>
        <ComplaintForm />
      </Suspense>
    </div>
  );
}
