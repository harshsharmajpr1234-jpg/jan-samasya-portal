"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Loader2, LogIn } from "lucide-react";

function CitizenLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/profile";

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    setLoading(true);
    try {
      const res = await fetch("/api/auth/citizen/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Invalid mobile number or password.");
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
          <LogIn className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold">Citizen Sign In</h1>
        <p className="mt-1 font-hindi text-sm text-muted-ink">नागरिक लॉग-इन — जन समस्या निवारण मंच</p>

        {error && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-flame/40 bg-flame/10 p-3 text-sm" role="alert">
            <CircleAlert className="h-4 w-4 shrink-0 text-flame" aria-hidden />
            <p>{error}</p>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className={labelCls} htmlFor="mobile">Registered mobile number *</label>
            <div className="flex overflow-hidden rounded-xl border border-line bg-cream transition focus-within:border-saffron focus-within:ring-2 focus-within:ring-saffron/25">
              <span className="grid place-items-center border-r border-line bg-paper-2 px-3 text-sm font-semibold text-muted-ink">+91</span>
              <input
                id="mobile"
                className="w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-ink/50"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                placeholder="10-digit mobile number"
                required
              />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="password">Password *</label>
            <input
              id="password"
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-flame px-6 py-3.5 font-display text-sm font-bold text-cream transition hover:bg-ink disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Sign In"}
        </button>

        <p className="mt-5 text-center text-xs text-muted-ink">
          Don&apos;t have a citizen account?{" "}
          <Link href={`/register${redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`} className="font-bold text-flame hover:underline">
            Register here
          </Link>
        </p>

        <div className="mt-6 border-t border-line pt-4 text-center">
          <Link href="/officer/login" className="text-xs text-muted-ink hover:text-ink">
            Are you a ward officer? Click here for Officer Login →
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function CitizenLoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-12 h-96 max-w-md animate-pulse rounded-3xl bg-paper-2" />}>
      <CitizenLoginForm />
    </Suspense>
  );
}
