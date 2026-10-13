import { PageHeader } from "@unipos/ui";
import { requireContext } from "@/lib/context";
import { ThemeForm } from "./form";

export const metadata = { title: "Theme" };

export default async function ThemePage() {
  const ctx = await requireContext("settings.edit");
  return (
    <div>
      <PageHeader title="Theme" description="UniPOS uses the Classic Blue theme. Override the brand colour for your business." />
      <ThemeForm initial={ctx.tenant.theme} />
    </div>
  );
}
