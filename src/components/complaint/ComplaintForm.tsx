"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  CircleAlert,
  Crosshair,
  Loader2,
  MapPin,
  PartyPopper,
  RotateCcw,
  Satellite,
  X,
} from "lucide-react";
import CopyButton from "@/components/CopyButton";
import { categoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/cn";

interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameHi: string;
}
interface WardOption {
  number: number;
  name: string;
}

const inputCls =
  "w-full rounded-xl border border-line bg-cream px-4 py-3 text-sm outline-none transition focus:border-saffron focus:ring-2 focus:ring-saffron/25 placeholder:text-muted-ink/50";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-ink";

type GpsState = "idle" | "locating" | "captured" | "denied" | "timeout" | "unavailable" | "unsupported";

function ComplaintFormInner() {
  const params = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [wardOptions, setWardOptions] = useState<WardOption[]>([]);

  const [ward, setWard] = useState<string>(params.get("ward") ?? "");
  const [manualText, setManualText] = useState("");
  const [landmarkText, setLandmarkText] = useState("");
  const [directionsText, setDirectionsText] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [gpsNote, setGpsNote] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ trackingId: string; mobile: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load categories once; preselect from ?category=<slug>.
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        const cats: Category[] = d.categories ?? [];
        setCategories(cats);
        const slug = params.get("category");
        if (slug) {
          const found = cats.find((c) => c.slug === slug);
          if (found) setCategoryId(found.id);
        }
      })
      .catch(() => setFormError("Could not load complaint categories. Please refresh the page."));

    // Check logged in citizen session to auto-fill details
    fetch("/api/auth/citizen/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.citizen) {
          setName(d.citizen.name || "");
          setMobile(d.citizen.mobile || "");
        }
      })
      .catch(() => {});

    // Wards come from the application's ward configuration, not a hardcoded list.
    fetch("/api/wards")
      .then((r) => r.json())
      .then((d) => setWardOptions(d.wards ?? []))
      .catch(() => setFormError("Could not load the ward list. Please refresh the page."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickPhoto = (file: File | null) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  /**
   * GPS is requested ONLY after an explicit click — never on page load.
   * GPS is strictly OPTIONAL: manual entry always works and submission is
   * never blocked by a denied/unavailable location.
   */
  const captureGps = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsState("unsupported");
      setGpsNote("This device cannot share a GPS location. You can still submit using the location you typed.");
      return;
    }
    setGpsState("locating");
    setGpsNote("Asking your browser for permission…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(6)));
        setLng(Number(pos.coords.longitude.toFixed(6)));
        setGpsState("captured");
        setGpsNote("Location captured successfully");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsState("denied");
          setGpsNote("Location permission was denied. That is fine — just type your colony or landmark above and submit.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsState("unavailable");
          setGpsNote("Your location is currently unavailable. You can still submit using the location you typed.");
        } else {
          setGpsState("timeout");
          setGpsNote("Getting your location took too long. You can still submit using the location you typed.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const reset = () => {
    setSuccess(null);
    setWard(""); setManualText(""); setLandmarkText(""); setDirectionsText("");
    setLat(null); setLng(null); setGpsState("idle"); setGpsNote(null);
    setCategoryId(""); setName(""); setMobile(""); setDescription("");
    pickPhoto(null);
    setFieldErrors({}); setFormError(null);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const errs: Record<string, string[]> = {};
    const manual = manualText.trim().replace(/\s+/g, " ");
    const landmark = landmarkText.trim().replace(/\s+/g, " ");
    const cleanMobile = mobile.replace(/\D/g, "").slice(-10);

    if (!name.trim() || name.trim().length < 2) {
      errs.citizenName = ["Full name is required (at least 2 characters)"];
    }

    if (cleanMobile.length !== 10 || !/^[6-9]\d{9}$/.test(cleanMobile)) {
      errs.citizenMobile = ["Enter a valid 10-digit Indian mobile number (starting with 6-9)"];
    }

    if (!ward) {
      errs.ward = ["Please select your ward (Ward 12, 13, or 14)"];
    }

    if (!categoryId) errs.categoryId = ["Please pick a complaint category"];

    if (!description.trim() || description.trim().length < 10) {
      errs.description = ["Please describe the problem in at least 10 characters"];
    }

    if (manual.length < 5) {
      errs.manualLocationText = ["Please enter your complete address / road / colony (at least 5 characters)"];
    } else if (manual.length > 200) {
      errs.manualLocationText = ["Please keep the address under 200 characters"];
    }

    if (landmark.length < 3) {
      errs.landmarkText = ["Please enter a nearby landmark (e.g. near school, temple, main road)"];
    } else if (landmark.length > 200) {
      errs.landmarkText = ["Please keep the landmark under 200 characters"];
    }

    if (!photo) {
      errs.photo = ["At least one photograph of the problem is required"];
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setFormError("Please correct the highlighted fields and submit again.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("citizenName", name.trim());
      fd.set("citizenMobile", cleanMobile);
      fd.set("categoryId", categoryId);
      fd.set("description", description.trim());
      fd.set("manualLocationText", manual);
      fd.set("addressText", manual);
      fd.set("landmarkText", landmark);
      if (directionsText.trim()) fd.set("directionsText", directionsText.trim());
      if (ward) fd.set("ward", ward);
      if (lat !== null && lng !== null) {
        fd.set("lat", String(lat));
        fd.set("lng", String(lng));
      }
      if (photo) fd.set("photo", photo);

      const res = await fetch("/api/complaints", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.issues) setFieldErrors(data.issues);
        setFormError(data.error ?? "Something went wrong. Please try again.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setSuccess({ trackingId: data.trackingId, mobile });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setFormError("Network error — please check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- Success state ---------- */
  if (success) {
    return (
      <div className="mx-auto mt-10 max-w-2xl">
        <div className="rounded-3xl border border-leaf/30 bg-resolved-bg/60 p-8 text-center shadow-lift sm:p-10">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-leaf text-cream">
            <PartyPopper className="h-7 w-7" aria-hidden />
          </span>
          <h2 className="mt-5 font-hindi text-2xl font-bold">शिकायत दर्ज हो गई!</h2>
          <p className="mt-1 font-display text-lg font-semibold">Complaint registered successfully</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-ink">
            Save this Tracking ID. You will need it <strong>together with your mobile number</strong> to check
            progress. No SMS is sent — this ID is your only receipt.
          </p>
          <div className="mx-auto mt-6 flex max-w-sm flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-ink/25 bg-cream px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-ink">Your Tracking ID</p>
            <p className="font-display text-3xl font-extrabold tracking-wider text-flame">{success.trackingId}</p>
            <CopyButton text={success.trackingId} label="Copy ID" />
          </div>
          <p className="mt-4 text-xs text-muted-ink">
            Registered mobile: <strong>+91 {success.mobile}</strong>
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/track"
              className="rounded-xl bg-ink px-6 py-3 font-display text-sm font-semibold text-cream transition hover:bg-ink-2"
            >
              Track it now
            </Link>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-cream px-6 py-3 font-display text-sm font-semibold transition hover:border-saffron"
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> File another
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Form ---------- */
  const gpsErrorState =
    gpsState === "denied" || gpsState === "timeout" || gpsState === "unavailable" || gpsState === "unsupported";

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-2">
      {formError && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-flame/40 bg-flame/10 p-4 text-sm text-ink lg:col-span-2"
          role="alert"
        >
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-flame" aria-hidden />
          <p>{formError}</p>
        </div>
      )}

      {/* ---- Citizen details ---- */}
      <section className="space-y-5 rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-8">
        <h2 className="font-display text-lg font-bold">Your details</h2>
        <div>
          <label className={labelCls} htmlFor="citizenName">Your name *</label>
          <input id="citizenName" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Full name" required />
          {fieldErrors.citizenName && <p className="mt-1 text-xs text-flame">{fieldErrors.citizenName[0]}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="mobile">Mobile number *</label>
          <div className="flex overflow-hidden rounded-xl border border-line bg-cream transition focus-within:border-saffron focus-within:ring-2 focus-within:ring-saffron/25">
            <span className="grid place-items-center border-r border-line bg-paper-2 px-3 text-sm font-semibold text-muted-ink">+91</span>
            <input
              id="mobile"
              className="w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-ink/50"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10-digit mobile"
              required
            />
          </div>
          {fieldErrors.citizenMobile && <p className="mt-1 text-xs text-flame">{fieldErrors.citizenMobile[0]}</p>}
          <p className="mt-1 text-[11px] text-muted-ink">Mandatory — used only for tracking this complaint.</p>
        </div>
      </section>

      {/* ---- Problem details ---- */}
      <section className="space-y-5 rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-8">
        <h2 className="font-display text-lg font-bold">Problem details</h2>
        <div>
          <span className={labelCls}>Complaint category *</span>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => {
              const Icon = categoryIcon(c.slug);
              const selected = categoryId === c.id;
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  aria-pressed={selected}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
                    selected ? "border-saffron bg-saffron/15 text-ink" : "border-line bg-paper text-muted-ink hover:border-saffron/60"
                  }`}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", selected && "text-flame")} aria-hidden />
                  <span>
                    <span className="block font-hindi leading-tight">{c.nameHi}</span>
                    <span className="block text-[10px] font-medium opacity-70">{c.nameEn}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {fieldErrors.categoryId && <p className="mt-1 text-xs text-flame">{fieldErrors.categoryId[0]}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="description">Describe the problem *</label>
          <textarea
            id="description"
            className={`${inputCls} min-h-28 resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            placeholder="What is wrong, since when, and how it affects people…"
            required
          />
          <p className="mt-1 text-right text-[11px] text-muted-ink">{description.length}/1000</p>
          {fieldErrors.description && <p className="text-xs text-flame">{fieldErrors.description[0]}</p>}
        </div>
      </section>

      {/* ---- PROBLEM LOCATION ---- */}
      <section className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-8 lg:col-span-2">
        <h2 className="font-display text-lg font-bold">Problem Location</h2>
        <p className="mt-1 text-sm text-muted-ink">
          Tell us where the problem is in your own words. Your entry is saved as a{" "}
          <strong>Citizen-provided location</strong>.
        </p>

        <div className="mt-5 grid gap-5 rounded-2xl border border-line bg-paper p-5 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="ward">Ward Selection *</label>
            <select id="ward" className={inputCls} value={ward} onChange={(e) => setWard(e.target.value)}>
              <option value="">Select ward</option>
              {wardOptions.map((w) => (
                <option key={w.number} value={w.number}>Ward {w.number}</option>
              ))}
            </select>
            {fieldErrors.ward && <p className="mt-1 text-xs text-flame">{fieldErrors.ward[0]}</p>}
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-ink">
              Only Ward 12, 13 and 14 are served.
            </p>
          </div>

          <div>
            <label className={labelCls} htmlFor="manualLocationText">Full Address / Road / Colony *</label>
            <input
              id="manualLocationText"
              className={inputCls}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              onBlur={(e) => setManualText(e.target.value.trim().replace(/\s+/g, " "))}
              maxLength={200}
              placeholder="e.g. Street, colony, road or house number"
              required
              aria-required="true"
            />
            {fieldErrors.manualLocationText && (
              <p className="mt-1 text-xs text-flame" role="alert">{fieldErrors.manualLocationText[0]}</p>
            )}
          </div>

          <div>
            <label className={labelCls} htmlFor="landmarkText">Nearby Landmark *</label>
            <input
              id="landmarkText"
              className={inputCls}
              value={landmarkText}
              onChange={(e) => setLandmarkText(e.target.value)}
              onBlur={(e) => setLandmarkText(e.target.value.trim().replace(/\s+/g, " "))}
              maxLength={200}
              placeholder="e.g. Near school, temple, hospital, main road or shop"
              required
              aria-required="true"
            />
            {fieldErrors.landmarkText && (
              <p className="mt-1 text-xs text-flame" role="alert">{fieldErrors.landmarkText[0]}</p>
            )}
          </div>

          <div>
            <label className={labelCls} htmlFor="directionsText">Additional Directions (optional)</label>
            <input
              id="directionsText"
              className={inputCls}
              value={directionsText}
              onChange={(e) => setDirectionsText(e.target.value)}
              maxLength={300}
              placeholder="e.g. Opposite the park, beside the corner shop"
            />
          </div>
        </div>

        {/* ---- Optional GPS ---- */}
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-paper p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-2">Optional: also attach your GPS position</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-ink">
                Sharing a GPS location is entirely optional and is requested only when you press the button.
                You can always submit without it.
              </p>
            </div>
            <button
              type="button"
              onClick={captureGps}
              disabled={gpsState === "locating"}
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-bold text-cream transition hover:bg-ink-2 disabled:opacity-60"
            >
              {gpsState === "locating" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Crosshair className="h-4 w-4" aria-hidden />
              )}
              Use my current location
            </button>
          </div>

          {gpsState === "captured" && (
            <p
              className="mt-3 flex items-center gap-2 rounded-xl border border-leaf/30 bg-resolved-bg px-3 py-2 text-sm font-semibold text-resolved"
              role="status"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Location captured successfully
            </p>
          )}
          {gpsState === "locating" && gpsNote && (
            <p className="mt-3 text-xs text-muted-ink" role="status">{gpsNote}</p>
          )}
          {gpsErrorState && gpsNote && (
            <p
              className="mt-3 flex items-start gap-2 rounded-xl border border-flame/40 bg-flame/10 px-3 py-2 text-sm text-ink"
              role="alert"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-flame" aria-hidden /> {gpsNote}
            </p>
          )}
        </div>
      </section>

      {/* ---- Photo ---- */}
      <section className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-8">
        <h2 className="font-display text-lg font-bold">Photo evidence *</h2>
        <p className="mt-1 text-xs text-muted-ink">Required — at least one photograph of the problem is required.</p>
        <div className="mt-4">
          {photoPreview ? (
            <div className="relative overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Selected complaint photo preview" className="h-44 w-full object-cover" />
              <button
                type="button"
                onClick={() => { pickPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-ink/80 text-cream transition hover:bg-flame"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-paper text-muted-ink transition hover:border-saffron hover:text-ink"
            >
              <Camera className="h-6 w-6" aria-hidden />
              <span className="text-xs font-semibold">Tap to add a photo</span>
              <span className="text-[10px]">JPG / PNG / WebP · max 4 MB</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
          />
          {fieldErrors.photo && <p className="mt-1 text-xs text-flame">{fieldErrors.photo[0]}</p>}
        </div>
      </section>

      {/* ---- Submit ---- */}
      <section className="flex flex-col justify-center gap-3 rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-8">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-ink">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-flame" aria-hidden />
          Your typed location is what helps ward officers find the problem. GPS coordinates are an optional extra.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-flame px-6 py-4 font-display text-base font-bold text-cream shadow-lift transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Registering…</span>
          ) : (
            "Submit complaint — शिकायत दर्ज करें"
          )}
        </button>
        <p className="text-center text-[11px] leading-relaxed text-muted-ink">
          By submitting you confirm this complaint concerns Ward 12, 13 or 14 and the details are true to your
          knowledge. False complaints waste community resources.
        </p>
      </section>
    </form>
  );
}

export default function ComplaintForm() {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-5xl animate-pulse rounded-3xl bg-paper-2" />}>
      <ComplaintFormInner />
    </Suspense>
  );
}
