import { cn } from "@/lib/cn";
import { STATUS_LABEL, type ComplaintStatusValue } from "@/lib/constants";
import { CircleDot, Loader, CheckCircle2 } from "lucide-react";

const STYLES: Record<ComplaintStatusValue, string> = {
  pending: "bg-pending-bg text-pending",
  in_progress: "bg-progress-bg text-progress",
  resolved: "bg-resolved-bg text-resolved",
};

const ICONS: Record<ComplaintStatusValue, typeof CircleDot> = {
  pending: CircleDot,
  in_progress: Loader,
  resolved: CheckCircle2,
};

export default function StatusBadge({ status, className }: { status: ComplaintStatusValue; className?: string }) {
  const Icon = ICONS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        STYLES[status],
        className,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", status === "in_progress" && "animate-pulse-soft")} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
