import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "@/components/officer/LoginForm";
import { Landmark } from "lucide-react";

export const metadata: Metadata = {
  title: "Officer Login",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OfficerLoginPage() {
  const session = await getSession();
  if (session) redirect("/officer/dashboard");

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
      <div className="hidden lg:block">
        <span className="grid size-14 place-items-center rounded-2xl bg-ink text-saffron shadow-lift">
          <Landmark className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight">
          Ward officer <span className="text-flame">console</span>
        </h1>
        <p className="mt-4 max-w-md leading-relaxed text-muted-ink">
          Registered ward officers and admins sign in here to view complaints routed to their ward, update
          statuses, and post dated remarks. Every action is written to the permanent audit history.
        </p>
        <ul className="mt-6 space-y-3 text-sm text-ink-2">
          <li className="flex items-center gap-2.5"><span className="size-2 rounded-full bg-saffron" /> Officers see only their own ward (12, 13 or 14)</li>
          <li className="flex items-center gap-2.5"><span className="size-2 rounded-full bg-saffron" /> Admins manage all wards, officers and areas</li>
          <li className="flex items-center gap-2.5"><span className="size-2 rounded-full bg-saffron" /> Sessions expire after 8 hours; passwords are bcrypt-hashed</li>
        </ul>
      </div>
      <LoginForm />
    </div>
  );
}
