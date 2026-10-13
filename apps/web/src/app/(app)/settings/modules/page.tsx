import { MODULES, MODULE_IDS } from "@unipos/core";
import { PageHeader } from "@unipos/ui";
import { requireContext } from "@/lib/context";
import { ModuleToggles } from "./toggles";

export const metadata = { title: "Modules" };

export default async function ModulesPage() {
  const ctx = await requireContext("settings.modules");
  return (
    <div>
      <PageHeader title="Modules" description="Turn features on or off for this business. Navigation, register and receipts adapt immediately." />
      <ModuleToggles modules={MODULE_IDS.map((id) => ({ ...MODULES[id], dependsOn: MODULES[id].dependsOn ?? [] }))} enabled={ctx.tenant.modules} />
    </div>
  );
}
