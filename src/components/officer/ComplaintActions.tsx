"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2, Send, UserPlus } from "lucide-react";
import { COMPLAINT_STATUSES, STATUS_LABEL, type ComplaintStatusValue } from "@/lib/constants";

interface Props {
  complaintId: string;
  currentStatus: ComplaintStatusValue;
  isAdmin: boolean;
  assignableOfficers: { id: string; name: string }[];
  assignedOfficerId: string | null;
}

const selectCls = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-saffron";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-ink";

export default function ComplaintActions({ complaintId, currentStatus, isAdmin, assignableOfficers, assignedOfficerId }: Props) {
  const router = useRouter();

  const [toStatus, setToStatus] = useState<ComplaintStatusValue | "">("");
  const [statusRemark, setStatusRemark] = useState("");
  const [statusPublic, setStatusPublic] = useState(true);
  const [officerId, setOfficerId] = useState(assignedOfficerId ?? "");
  const [remark, setRemark] = useState("");
  const [remarkPublic, setRemarkPublic] = useState(true);

  const [busy, setBusy] = useState<"status" | "assign" | "remark" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function post(body: Record<string, unknown>, kind: NonNullable<typeof busy>) {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch(`/api/officer/complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "err", text: data.error ?? "Action failed. Please retry." });
        return;
      }
      setMessage({ kind: "ok", text: "Saved and written to the audit history." });
      if (kind === "status") { setToStatus(""); setStatusRemark(""); }
      if (kind === "remark") setRemark("");
      router.refresh();
    } catch {
      setMessage({ kind: "err", text: "Network error — please retry." });
    } finally {
      setBusy(null);
    }
  }

  const lockedForOfficer = currentStatus === "resolved" && !isAdmin;
  const nextStatuses = COMPLAINT_STATUSES.filter((s) => s !== currentStatus);

  return (
    <div className="rounded-3xl border border-line bg-cream p-6 shadow-card sm:p-7">
      <h2 className="font-display text-lg font-bold">Take action</h2>

      {message && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-sm ${
            message.kind === "ok" ? "border-leaf/40 bg-resolved-bg text-resolved" : "border-flame/40 bg-flame/10 text-ink"
          }`}
          role="status"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {message.text}
        </div>
      )}

      {/* ----- Status update ----- */}
      <fieldset className="mt-5 border-t border-line pt-5" disabled={lockedForOfficer}>
        <legend className="sr-only">Update status</legend>
        <label className={labelCls} htmlFor="toStatus">Change status</label>
        {lockedForOfficer ? (
          <p className="rounded-lg bg-paper p-3 text-xs text-muted-ink">
            This complaint is resolved. Only an admin can reopen or change it.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <select
                id="toStatus"
                className={selectCls}
                value={toStatus}
                onChange={(e) => setToStatus(e.target.value as ComplaintStatusValue)}
              >
                <option value="">Choose next status…</option>
                {nextStatuses.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => toStatus && post({ action: "status", toStatus, remark: statusRemark, isPublic: statusPublic }, "status")}
                disabled={!toStatus || busy !== null || (toStatus === "resolved" && statusRemark.trim().length === 0)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-4 text-sm font-bold text-cream transition hover:bg-ink-2 disabled:opacity-50"
              >
                {busy === "status" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                Apply
              </button>
            </div>
            <textarea
              className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-saffron"
              rows={2}
              maxLength={500}
              placeholder={toStatus === "resolved" ? "Resolution remark (required) — citizen will see this" : "Optional remark with this change"}
              value={statusRemark}
              onChange={(e) => setStatusRemark(e.target.value)}
            />
            <label className="mt-1 flex items-center gap-2 text-xs text-muted-ink">
              <input type="checkbox" checked={statusPublic} onChange={(e) => setStatusPublic(e.target.checked)} className="size-3.5 accent-[#e35d1c]" />
              Visible to the citizen on the public timeline
            </label>
          </>
        )}
      </fieldset>

      {/* ----- Assignment (admin) ----- */}
      {isAdmin && (
        <div className="mt-5 border-t border-line pt-5">
          <label className={labelCls} htmlFor="officerId">Assign to ward officer</label>
          {assignableOfficers.length === 0 ? (
            <p className="rounded-lg bg-paper p-3 text-xs text-muted-ink">
              No active officers exist for this ward yet — create one from the Admin page.
            </p>
          ) : (
            <div className="flex gap-2">
              <select id="officerId" className={selectCls} value={officerId} onChange={(e) => setOfficerId(e.target.value)}>
                <option value="">Select officer…</option>
                {assignableOfficers.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => officerId && post({ action: "assign", officerId }, "assign")}
                disabled={!officerId || busy !== null}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-saffron px-4 text-sm font-bold text-ink transition hover:bg-cream hover:ring-1 hover:ring-ink/20 disabled:opacity-50"
              >
                {busy === "assign" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
                Assign
              </button>
            </div>
          )}
        </div>
      )}

      {/* ----- Remark ----- */}
      <div className="mt-5 border-t border-line pt-5">
        <label className={labelCls} htmlFor="remark">Add a remark</label>
        <textarea
          id="remark"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-saffron"
          rows={2}
          maxLength={500}
          placeholder="e.g. Team dispatched, expected fix by Friday"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-ink">
            <input type="checkbox" checked={remarkPublic} onChange={(e) => setRemarkPublic(e.target.checked)} className="size-3.5 accent-[#e35d1c]" />
            Visible to the citizen
          </label>
          <button
            type="button"
            onClick={() => remark.trim() && post({ action: "remark", text: remark.trim(), isPublic: remarkPublic }, "remark")}
            disabled={!remark.trim() || busy !== null}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-cream transition hover:bg-ink-2 disabled:opacity-50"
          >
            {busy === "remark" ? "Saving…" : "Add remark"}
          </button>
        </div>
      </div>
    </div>
  );
}
