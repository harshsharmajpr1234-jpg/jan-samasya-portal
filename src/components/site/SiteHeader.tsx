import { ShieldAlert } from "lucide-react";
import { getConfiguredWardNumbers } from "@/lib/wards";
import { getCitizenSession } from "@/lib/auth";
import SiteHeaderNav from "./SiteHeaderNav";

export default async function SiteHeader() {
  const [wardNumbers, citizenSession] = await Promise.all([
    getConfiguredWardNumbers(),
    getCitizenSession(),
  ]);
  const wardLabel = wardNumbers.length > 0 ? wardNumbers.join(" · ") : "12 · 13 · 14";

  return (
    <header className="sticky top-0 z-40">
      {/* Independence notice — always visible, cleanly wrapped for all screen sizes */}
      <div className="flex items-center justify-center gap-1.5 bg-ink px-3 py-1.5 text-center text-[10px] font-medium leading-normal tracking-wide text-cream/90 sm:text-xs">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-saffron" aria-hidden />
        <span className="truncate sm:whitespace-normal">
          Independent citizen portal — not an official government website · केवल पंजीकृत वार्डों हेतु
        </span>
      </div>

      <div className="border-b border-line bg-cream/90 backdrop-blur-md">
        <SiteHeaderNav wardLabel={wardLabel} citizenSession={citizenSession} />
      </div>
    </header>
  );
}
