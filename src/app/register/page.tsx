"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Loader2, UserPlus } from "lucide-react";

function RegisterFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/profile";

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: ["Passwords do not match"] });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/citizen/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mobile,
          email: email.trim() || undefined,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.issues) setFieldErrors(data.issues);
        setError(data.error === "Validation failed" ? "Please correct the highlighted fields below." : (data.error ?? "Registration failed. Please check your entries."));
        return;
      }

      router.push(redirectUrl);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-line bg-cream px-4 py-3 text-sm outline-none transition focus:border-saffron focus:ring-2 focus:ring-saffron/25 placeholder:text-muted-ink/50";
  const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-ink";

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={onSubmit} className="rounded-3xl border border-line bg-cream p-8 shadow-card">
        <span className="grid size-12 place-items-center rounded-2xl bg-ink text-saffron">
          <UserPlus className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold">Citizen Registration</h1>
        <p className="mt-1 font-hindi text-sm text-muted-ink">नागरिक पंजीकरण — जन समस्या निवारण मंच</p>

        {error && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-flame/40 bg-flame/10 p-3 text-sm" role="alert">
            <CircleAlert className="h-4 w-4 shrink-0 text-flame" aria-hidden />
            <p>{error}</p>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className={labelCls} htmlFor="name">Full name *</label>
            <input
              id="name"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-flame">{fieldErrors.name[0]}</p>}
          </div>

          <div>
            <label className={labelCls} htmlFor="mobile">Mobile number *</label>
            <div className="flex overflow-hidden rounded-xl border border-line bg-cream transition focus-within:border-saffron focus-within:ring-2 focus-within:ring-saffron/25">
              <span className="grid place-items-center border-r border-line bg-paper-2 px-3 text-sm font-semibold text-muted-ink">+91</span>
              <input
                id="mobile"
                className="w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-ink/50"
                value={mobile}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  const clean = raw.length > 10 && (raw.startsWith("91") || raw.startsWith("0")) ? raw.slice(-10) : raw.slice(0, 10);
                  setMobile(clean);
                }}
                inputMode="numeric"
                placeholder="10-digit mobile number"
                required
              />
            </div>
            {fieldErrors.mobile && <p className="mt-1 text-xs text-flame">{fieldErrors.mobile[0]}</p>}
          </div>

          <div>
            <label className={labelCls} htmlFor="email">Email address (optional)</label>
            <input
              id="email"
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-flame">{fieldErrors.email[0]}</p>}
          </div>

          <div>
            <label className={labelCls} htmlFor="password">Password *</label>
            <input
              id="password"
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
            {fieldErrors.password && <p className="mt-1 text-xs text-flame">{fieldErrors.password[0]}</p>}
          </div>

          <div>
            <label className={labelCls} htmlFor="confirmPassword">Confirm Password *</label>
            <input
              id="confirmPassword"
              type="password"
              className={inputCls}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
            />
            {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-flame">{fieldErrors.confirmPassword[0]}</p>}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-flame px-6 py-3.5 font-display text-sm font-bold text-cream transition hover:bg-ink disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Create Citizen Account"}
        </button>

        <p className="mt-5 text-center text-xs text-muted-ink">
          Already registered?{" "}
          <Link href={`/login${redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`} className="font-bold text-flame hover:underline">
            Sign in here
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-12 h-96 max-w-md animate-pulse rounded-3xl bg-paper-2" />}>
      <RegisterFormInner />
    </Suspense>
  );
}
