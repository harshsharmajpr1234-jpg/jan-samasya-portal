"use client";

import { useRouter } from "next/navigation";
import { Loader2, MapPinned, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

const inputCls = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-saffron";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-ink";

export default function AdminPanels() {
  const router = useRouter();

  // Wards come from the application's ward configuration (never hardcoded).
  const [wardOptions, setWardOptions] = useState<number[]>([]);
  useEffect(() => {
    fetch("/api/wards")
      .then((r) => r.json())
      .then((d) => setWardOptions((d.wards ?? []).map((w: { number: number }) => w.number)))
      .catch(() => setWardOptions([]));
  }, []);

  // --- create officer ---
  const [oName, setOName] = useState("");
  const [oEmail, setOEmail] = useState("");
  const [oPassword, setOPassword] = useState("");
  const [oRole, setORole] = useState<"officer" | "admin">("officer");
  const [oWard, setOWard] = useState("12");
  const [oBusy, setOBusy] = useState(false);
  const [oMsg, setOMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // --- add area ---
  const [aWard, setAWard] = useState("12");
  const [aName, setAName] = useState("");
  const [aBusy, setABusy] = useState(false);
  const [aMsg, setAMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function createOfficer(e: React.FormEvent) {
    e.preventDefault();
    setOBusy(true);
    setOMsg(null);
    try {
      const res = await fetch("/api/admin/officers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: oName,
          email: oEmail,
          password: oPassword,
          role: oRole,
          ...(oRole === "officer" ? { ward: Number(oWard) } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const issues = data.issues ? Object.values(data.issues).flat().join(" ") : null;
        setOMsg({ ok: false, text: issues || data.error || "Could not create the account." });
        return;
      }
      setOMsg({ ok: true, text: `Account created for ${data.officer.name}. Share the password privately — it is stored hashed.` });
      setOName(""); setOEmail(""); setOPassword("");
      router.refresh();
    } catch {
      setOMsg({ ok: false, text: "Network error — please retry." });
    } finally {
      setOBusy(false);
    }
  }

  async function addArea(e: React.FormEvent) {
    e.preventDefault();
    setABusy(true);
    setAMsg(null);
    try {
      const res = await fetch("/api/admin/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ward: Number(aWard), name: aName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAMsg({ ok: false, text: data.error || "Could not add the area." });
        return;
      }
      setAMsg({ ok: true, text: `"${data.area.name}" added to Ward ${aWard}.` });
      setAName("");
      router.refresh();
    } catch {
      setAMsg({ ok: false, text: "Network error — please retry." });
    } finally {
      setABusy(false);
    }
  }

  const msgCls = (ok: boolean) =>
    `mt-3 rounded-xl border p-3 text-sm ${ok ? "border-leaf/40 bg-resolved-bg text-resolved" : "border-flame/40 bg-flame/10 text-ink"}`;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      {/* Create officer */}
      <form onSubmit={createOfficer} className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-7">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <UserPlus className="h-5 w-5 text-flame" aria-hidden /> Create officer account
        </h2>
        {oMsg && <p className={msgCls(oMsg.ok)} role="status">{oMsg.text}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="oName">Name</label>
            <input id="oName" className={inputCls} value={oName} onChange={(e) => setOName(e.target.value)} required minLength={2} />
          </div>
          <div>
            <label className={labelCls} htmlFor="oEmail">Email</label>
            <input id="oEmail" type="email" className={inputCls} value={oEmail} onChange={(e) => setOEmail(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls} htmlFor="oPassword">Temporary password</label>
            <input
              id="oPassword"
              className={inputCls}
              value={oPassword}
              onChange={(e) => setOPassword(e.target.value)}
              required
              minLength={10}
              placeholder="Min 10 chars, letter + digit"
              autoComplete="new-password"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="oRole">Role</label>
              <select id="oRole" className={inputCls} value={oRole} onChange={(e) => setORole(e.target.value as "officer" | "admin")}>
                <option value="officer">Officer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="oWard">Ward</label>
              <select id="oWard" className={inputCls} value={oWard} onChange={(e) => setOWard(e.target.value)} disabled={oRole === "admin"}>
                {wardOptions.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={oBusy}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-cream transition hover:bg-ink-2 disabled:opacity-60"
        >
          {oBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
          Create account
        </button>
      </form>

      {/* Add area */}
      <form onSubmit={addArea} className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-7">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <MapPinned className="h-5 w-5 text-flame" aria-hidden /> Add area to a ward
        </h2>
        {aMsg && <p className={msgCls(aMsg.ok)} role="status">{aMsg.text}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr]">
          <div>
            <label className={labelCls} htmlFor="aWard">Ward</label>
            <select id="aWard" className={inputCls} value={aWard} onChange={(e) => setAWard(e.target.value)}>
              {wardOptions.map((w) => (
                <option key={w} value={w}>Ward {w}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="aName">Area / mohalla name</label>
            <input id="aName" className={inputCls} value={aName} onChange={(e) => setAName(e.target.value)} required minLength={2} maxLength={80} />
          </div>
        </div>
        <button
          type="submit"
          disabled={aBusy}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-cream transition hover:bg-ink-2 disabled:opacity-60"
        >
          {aBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MapPinned className="h-4 w-4" aria-hidden />}
          Add area
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-ink">
          Only Ward 12, 13 and 14 are served — new wards cannot be created from this console.
        </p>
      </form>
    </div>
  );
}
