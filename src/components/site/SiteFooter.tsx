import Link from "next/link";
import { Landmark, Mail, MapPin, Phone, ShieldAlert, Users } from "lucide-react";
import { APP_NAME, APP_NAME_HI } from "@/lib/constants";
import { getConfiguredWards } from "@/lib/wards";

/** Community volunteers who run this initiative — NOT government officials. */
const CONTACTS = [
  {
    name: "Harsh Sharma",
    mobile: "6350535424",
    tel: "+916350535424",
    email: "harshsharmajpr1234@gmail.com",
  },
  {
    name: "Ritesh Kumar Sharma",
    mobile: "9782852499",
    tel: "+919782852499",
    email: "riteshsharmajpr123@gmail.com",
  },
];

export default async function SiteFooter() {
  const wardList = await getConfiguredWards();
  const wardNumbers = wardList.map((w) => w.number);
  return (
    <footer className="mt-24 border-t border-ink/10 bg-ink text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_0.9fr_0.8fr_1.15fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-cream/10">
              <Landmark className="h-5 w-5 text-saffron" aria-hidden />
            </span>
            <div>
              <p className="font-hindi text-xl font-bold">{APP_NAME_HI}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-cream/60">{APP_NAME}</p>
            </div>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/70">
            A citizen-run grievance desk for {wardNumbers.map((w) => `Ward ${w}`).join(", ")} residents. Complaints filed
            here are recorded in our own independent database and followed up by registered local ward officers.
          </p>
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-saffron/30 bg-saffron/10 p-3 text-xs leading-relaxed text-saffron">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              <strong>Important:</strong> this is an independent community initiative. It is{" "}
              <strong>not</strong> an official government, municipal or Nagar Nigam website, and it is{" "}
              <strong>not</strong> integrated with any government system. For emergencies please contact official
              municipal channels directly.
            </p>
          </div>
        </div>

        <nav aria-label="Footer">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cream/50">Portal</p>
          <ul className="mt-4 space-y-2.5 text-sm text-cream/80">
            <li><Link className="transition hover:text-saffron" href="/complaint/new">File a Complaint</Link></li>
            <li><Link className="transition hover:text-saffron" href="/track">Track Complaint</Link></li>
            <li><Link className="transition hover:text-saffron" href="/#how">How it works</Link></li>
            <li><Link className="transition hover:text-saffron" href="/officer/login">Officer Login</Link></li>
          </ul>
        </nav>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cream/50">Coverage</p>
          <ul className="mt-4 space-y-2.5 text-sm text-cream/80">
            {wardList.map((w) => (
              <li key={w.number} className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-saffron" aria-hidden /> Ward {w.number}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-cream/50">
            Only the wards listed above are currently configured. Complaints outside this coverage cannot be
            accepted.
          </p>
        </div>

        {/* ---- Contact the Initiative ---- */}
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cream/50">
            <Users className="h-3.5 w-3.5 text-saffron" aria-hidden />
            Contact the Initiative
          </p>
          <p className="mt-3 text-xs leading-relaxed text-cream/50">
            Reach the community volunteers who run this portal. They are{" "}
            <strong className="text-cream/70">not</strong> government or Nagar Nigam officials.
          </p>
          <ul className="mt-4 space-y-4">
            {CONTACTS.map((c) => (
              <li key={c.email} className="rounded-xl border border-cream/10 bg-cream/5 p-3">
                <p className="text-sm font-semibold text-cream">{c.name}</p>
                <a
                  href={`tel:${c.tel}`}
                  className="mt-1.5 flex items-center gap-2 text-sm text-cream/80 transition hover:text-saffron focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0 text-saffron" aria-hidden />
                  <span>
                    <span className="text-cream/50">Mobile:</span> {c.mobile}
                  </span>
                </a>
                <a
                  href={`mailto:${c.email}`}
                  className="mt-1.5 flex items-start gap-2 break-all text-sm text-cream/80 transition hover:text-saffron focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron"
                >
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-saffron" aria-hidden />
                  <span>
                    <span className="text-cream/50">Email:</span> {c.email}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-cream/10 py-4 text-center text-[11px] text-cream/45">
        Built with zero-cost-first open tooling · Map data © OpenStreetMap contributors · {new Date().getFullYear()}{" "}
        {APP_NAME}
      </div>
    </footer>
  );
}
