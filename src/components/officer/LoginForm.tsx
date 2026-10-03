"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { CircleAlert, Loader2, Lock, LogIn } from "lucide-react";

/** Never let a stalled request hold the UI hostage. */
const REQUEST_TIMEOUT_MS = 20_000;

type Phase = "idle" | "submitting" | "verifying" | "navigating";

/** Parse a response body without ever throwing. */
async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const text = await res.text();
    if (!text) return {};
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function messageFor(status: number, body: Record<string, unknown>): string {
  const serverMsg = typeof body.error === "string" ? body.error : null;
  if (status === 401) return serverMsg ?? "Invalid email or password.";
  if (status === 403) return serverMsg ?? "You do not have permission to access the officer console.";
  if (status === 429) return serverMsg ?? "Too many sign-in attempts. Please wait a few minutes and try again.";
  if (status >= 500) return serverMsg ?? "The server could not complete sign-in. Please try again shortly.";
  return serverMsg ?? "Sign-in failed. Please try again.";
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  // Ref (not state) so a double-click inside the same tick cannot slip through.
  const inFlight = useRef(false);
  // True when this page is rendered inside another site's <iframe>.
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setEmbedded(window.self !== window.top);
      } catch {
        setEmbedded(true);
      }
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Prevent duplicate submissions while a request is in progress.
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setPhase("submitting");
    setError(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      // ---- 1. authenticate ----
      let res: Response;
      try {
        res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
          // "include" so the session cookie is stored/sent both on same-origin
          // deployments and in a cross-origin embedded preview.
          credentials: "include",
        });
      } catch (fetchErr) {
        if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
          setError("Sign-in took too long. Please check your connection and try again.");
        } else {
          setError("Network error — please check your connection and retry.");
        }
        return;
      }

      const body = await safeJson(res);

      if (!res.ok) {
        // 401 / 403 / 429 / 5xx all produce a visible message and stop loading.
        setError(messageFor(res.status, body));
        return;
      }

      // Only trust a response the server explicitly marked as successful.
      if (body.ok !== true) {
        setError("Sign-in could not be confirmed. Please try again.");
        return;
      }

      // ---- 2. confirm the session actually exists before navigating ----
      // A 200 alone is not enough: if the cookie was dropped (Secure/SameSite,
      // wrong origin) a redirect would bounce straight back here. Verify first.
      setPhase("verifying");
      try {
        // Ask the server TWO separate questions rather than guessing:
        //   1. did the browser actually send the session cookie back?
        //   2. did that cookie verify?
        // A naive 401 check cannot tell these apart and wrongly blames cookies.
        const check = await fetch("/api/auth/session", {
          credentials: "include",
          signal: controller.signal,
        });
        const session = await safeJson(check);

        if (session.authenticated !== true) {
          const cookieSent = session.cookieReceived === true;
          if (!cookieSent) {
            setError(
              embedded
                ? "Sign-in succeeded, but this page is embedded inside another website and your browser is blocking the session cookie in that frame. Open the portal in a normal browser tab to sign in."
                : "Sign-in succeeded, but your browser did not send the session cookie back. Please enable cookies for this site and try again.",
            );
          } else {
            setError(
              "Sign-in succeeded, but the session was rejected by the server. Please try again — if it keeps happening, ask the administrator to check the deployment's session configuration.",
            );
          }
          return;
        }
      } catch {
        // The diagnostic itself is best-effort: never block a good sign-in.
      }

      // ---- 3. navigate exactly once ----
      setPhase("navigating");
      await router.replace("/officer/dashboard");
    } catch {
      setError("Something went wrong while signing in. Please try again.");
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      setLoading(false);
      setPhase("idle");
    }
  }

  const inputCls =
    "w-full rounded-xl border border-line bg-cream px-4 py-3 text-sm outline-none transition focus:border-saffron focus:ring-2 focus:ring-saffron/25";

  const busyLabel =
    phase === "verifying" ? "Confirming session…" : phase === "navigating" ? "Opening dashboard…" : "Signing in…";

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md rounded-3xl border border-line bg-cream p-8 shadow-lift">
      <span className="grid size-12 place-items-center rounded-2xl bg-ink text-saffron">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-2xl font-bold">Officer sign in</h2>
      <p className="mt-1 text-sm text-muted-ink">Ward 12 · 13 · 14 authorized personnel only.</p>

      {error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-flame/40 bg-flame/10 p-3 text-sm" role="alert">
          <CircleAlert className="h-4 w-4 shrink-0 text-flame" aria-hidden />
          {error}
        </div>
      )}

      {/* Embedded frames often cannot keep cookies at all — offer the safe
          escape hatch of a normal top-level tab before the user retries. */}
      {embedded && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper p-3 text-xs">
          <p className="flex-1 text-muted-ink">
            This preview runs inside another site&apos;s frame. For reliable sign-in, open the portal in its own tab.
          </p>
          <a
            href={typeof window === "undefined" ? "/" : window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 font-bold text-cream transition hover:bg-ink-2"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Open in new tab
          </a>
        </div>
      )}

      <label htmlFor="email" className="mb-1.5 mt-6 block text-xs font-bold uppercase tracking-wider text-muted-ink">
        Official email
      </label>
      <input
        id="email"
        type="email"
        className={inputCls}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="username"
        placeholder="officer@example.org"
        disabled={loading}
        required
      />

      <label htmlFor="password" className="mb-1.5 mt-4 block text-xs font-bold uppercase tracking-wider text-muted-ink">
        Password
      </label>
      <input
        id="password"
        type="password"
        className={inputCls}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        placeholder="••••••••••"
        disabled={loading}
        required
      />

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-flame px-6 py-3.5 font-display text-sm font-bold text-cream transition hover:bg-ink disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogIn className="h-4 w-4" aria-hidden />}
        {loading ? busyLabel : "Sign in securely"}
      </button>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-ink">
        Failed attempts are rate-limited. Accounts are created by the manch admin — there is no self-signup.
      </p>
    </form>
  );
}
