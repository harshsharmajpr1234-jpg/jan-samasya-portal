import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OfficerIndex() {
  const session = await getSession();
  redirect(session ? "/officer/dashboard" : "/officer/login");
}
