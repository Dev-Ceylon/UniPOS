import { PageHeader } from "@unipos/ui";
import { requireContext } from "@/lib/context";
import { CustomFieldsEditor } from "./editor";

export const metadata = { title: "Custom fields" };

export default async function CustomFieldsPage() {
  const ctx = await requireContext("settings.edit");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Custom fields" description="Add your own fields to products and customers — no migrations needed." />
      <CustomFieldsEditor entity="product" initial={ctx.settings.customFields.product} />
      {ctx.tenant.modules.includes("customers") ? <CustomFieldsEditor entity="customer" initial={ctx.settings.customFields.customer} /> : null}
    </div>
  );
}
