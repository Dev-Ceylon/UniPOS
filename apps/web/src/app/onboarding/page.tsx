import { redirect } from "next/navigation";
import { getAppContext, getSession } from "@/lib/context";
import { OnboardingForm } from "./form";

export const metadata = { title: "Set up your business" };

export default async function Onboarding() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (await getAppContext()) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-2xl p-4 py-10">
      <OnboardingForm defaultName={session.user.name} />
    </main>
  );
}
