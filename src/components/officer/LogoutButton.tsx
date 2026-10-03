"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/officer/login");
        router.refresh();
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-cream/25 px-3 py-1.5 text-xs font-bold text-cream transition hover:bg-cream/10"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
    </button>
  );
}
