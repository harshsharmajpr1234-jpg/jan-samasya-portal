"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  FileText,
  Loader2,
  Lock,
  MapPin,
  MessageSquareQuote,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import type { ComplaintStatusValue } from "@/lib/constants";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-[260px] w-full animate-pulse rounded-2xl bg-paper-2" />,
});

interface TimelineEvent {
  type: "created" | "status_changed" | "assigned" | "remark_added";
  label: string;
  fromStatus: string | null;
  toStatus: string | null;
  remark: string | null;
  at: string;
}

interface TrackResult {
  trackingId: string;
  status: ComplaintStatusValue;
  statusLabel: string;
  ward: number;
  area: string;
  category: { nameEn: string; nameHi: string };
  description: string;
  addressText: string | null;
  manualLocationText: string | null;
  locationMethod: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  timeline: TimelineEvent[];
  photoUrl: string | null;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

function TimelineIcon({ type }: { type: TimelineEvent["type"] }) {
  if (type === "created") return <FileText className="h-4 w-4" aria-hidden />;
  if (type === "remark_added") return <MessageSquareQuote className="h-4 w-4" aria-hidden />;
  return <BadgeCheck className="h-4 w-4" aria-hidden />;
}

function TrackFormInner() {
  const params = useSearchParams();
  const [trackingId, setTrackingId] = useState(params.get("id") ?? "");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);

  async function search(id: string, m: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/complaints/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingId: id, mobile: m }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not fetch the complaint. Please retry.");
        return;
      }
      setResult(data as TrackResult);
    } catch {
      setError("Network error — please check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      const id = params.get("id");
      if (id && /^JSNM-\d{2}-[A-Z0-9]{6}$/i.test(id)) setTrackingId(id.toUpperCase());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusStep = result ? (result.status === "pending" ? 0 : result.status === "in_progress" ? 1 : 2) : 0;

  return (
    <div className="mx-auto mt-10 max-w-3xl">
      {/* -------- Search card -------- */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(trackingId.trim().toUpperCase(), mobile.trim());
        }}
        className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-8"
      >
        <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
          <div>
            <label htmlFor="trackingId" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-ink">
              Tracking ID
            </label>
            <input
              id="trackingId"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
              placeholder="JSNM-12-XXXXXX"
              autoComplete="off"
              className="w-full rounded-xl border border-line bg-paper px-4 py-3 font-display text-sm font-bold tracking-widest outline-none transition focus:border-saffron focus:ring-2 focus:ring-saffron/25"
              required
            />
          </div>
          <div>
            <label htmlFor="trackMobile" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-ink">
              Registered mobile
            </label>
            <input
              id="trackMobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile"
              inputMode="numeric"
              autoComplete="tel"
              className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-saffron focus:ring-2 focus:ring-saffron/25"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 font-display text-sm font-bold text-cream transition hover:bg-ink-2 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
          {loading ? "Checking…" : "Check status"}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-ink">
          <Lock className="h-3 w-3" aria-hidden /> Lookups are rate-limited to protect your privacy.
        </p>
      </form>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-flame/40 bg-flame/10 p-4 text-sm" role="alert">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-flame" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {/* -------- Result -------- */}
      {result && (
        <div className="mt-8 space-y-6">
          <div className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-display text-lg font-extrabold tracking-wider text-flame">{result.trackingId}</p>
                <h2 className="mt-1 font-hindi text-2xl font-bold leading-snug">
                  {result.category.nameHi}
                  <span className="ml-2 align-middle font-body text-sm font-medium text-muted-ink">{result.category.nameEn}</span>
                </h2>
                <p className="mt-1 text-sm text-muted-ink">
                  {result.ward !== null ? `Ward ${result.ward}` : "Ward not selected"}
                  {result.area ? ` · ${result.area}` : ""}
                  {result.addressText ? ` · ${result.addressText}` : ""}
                </p>
                {(result.manualLocationText || result.locationMethod) && (
                  <p className="mt-1.5 inline-flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-1.5 text-xs">
                    {result.manualLocationText && (
                      <span className="text-ink-2">
                        <strong className="font-semibold">Citizen-provided location:</strong>{" "}
                        {result.manualLocationText}
                      </span>
                    )}
                    {result.locationMethod && (
                      <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-saffron">
                        {result.locationMethod.replace("_", " + ")}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <StatusBadge status={result.status} />
            </div>

            {/* Progress rail */}
            <div className="mt-7 flex items-center">
              {["Pending", "In Progress", "Resolved"].map((label, i) => (
                <div key={label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid size-8 place-items-center rounded-full border-2 text-xs font-extrabold transition ${
                        i <= statusStep ? "border-leaf bg-leaf text-cream" : "border-line bg-paper text-muted-ink"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className={`mt-1.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide ${i <= statusStep ? "text-leaf" : "text-muted-ink"}`}>
                      {label}
                    </span>
                  </div>
                  {i < 2 && <div className={`mx-2 mb-5 h-0.5 flex-1 rounded ${i < statusStep ? "bg-leaf" : "bg-line"}`} />}
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-paper p-4">
              <p className="text-sm leading-relaxed text-ink-2">{result.description}</p>
            </div>

            <div className="mt-4 grid gap-2 text-xs text-muted-ink sm:grid-cols-3">
              <p>Filed: <strong className="text-ink">{fmt(result.createdAt)}</strong></p>
              <p>Last update: <strong className="text-ink">{fmt(result.updatedAt)}</strong></p>
              {result.resolvedAt && <p>Resolved: <strong className="text-resolved">{fmt(result.resolvedAt)}</strong></p>}
            </div>
          </div>

          {(result.photoUrl || (result.lat !== null && result.lng !== null)) && (
            <div className="grid gap-6 sm:grid-cols-2">
              {result.photoUrl && (
                <figure className="overflow-hidden rounded-3xl border border-line bg-cream shadow-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result.photoUrl} alt="Photo you attached to this complaint" className="h-64 w-full object-cover" loading="lazy" />
                  <figcaption className="px-4 py-2 text-[11px] text-muted-ink">Photo submitted with this complaint (visible only to you and officers)</figcaption>
                </figure>
              )}
              {result.lat !== null && result.lng !== null && (
                <div className="rounded-3xl border border-line bg-cream p-3 shadow-card">
                  <LeafletMap lat={result.lat} lng={result.lng} readOnly height={248} />
                  <p className="flex items-center gap-1.5 px-2 pt-2 text-[11px] text-muted-ink">
                    <MapPin className="h-3 w-3 text-flame" aria-hidden /> Location pin you dropped
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-8">
            <h3 className="font-display text-lg font-bold">Progress timeline · प्रगति</h3>
            <ol className="mt-5 space-y-0">
              {[...result.timeline].reverse().map((ev, i) => (
                <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < result.timeline.length - 1 && <span className="absolute left-[15px] top-8 h-full w-0.5 bg-line" aria-hidden />}
                  <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-ink text-saffron">
                    <TimelineIcon type={ev.type} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-sm font-bold">
                        {ev.type === "created"
                          ? "Complaint registered"
                          : ev.type === "status_changed"
                            ? `Status: ${ev.fromStatus?.replace("_", " ")} → ${ev.toStatus?.replace("_", " ")}`
                            : "Remark from ward office"}
                      </p>
                      <p className="text-[11px] text-muted-ink">{ev.label} · {fmt(ev.at)}</p>
                    </div>
                    {ev.remark && <p className="mt-1 rounded-lg bg-paper px-3 py-2 text-sm text-ink-2">{ev.remark}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackForm() {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-72 max-w-xl animate-pulse rounded-3xl bg-paper-2" />}>
      <TrackFormInner />
    </Suspense>
  );
}
