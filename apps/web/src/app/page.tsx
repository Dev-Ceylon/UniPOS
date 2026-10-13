import { redirect } from "next/navigation";
import { getAppContext, getSession } from "@/lib/context";
import { can } from "@unipos/core";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const ctx = await getAppContext();
  if (!ctx) redirect("/onboarding");
  redirect(can(ctx.member, "dashboard.view") ? "/dashboard" : "/register");
}
