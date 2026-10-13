import { PageHeader } from "@unipos/ui";
import { requireContext } from "@/lib/context";
import { ReceiptEditor } from "./editor";

export const metadata = { title: "Receipt template" };

export default async function ReceiptPage() {
  const ctx = await requireContext("settings.edit");
  const loc = ctx.locations.find((l) => l.id === ctx.locationId);
  return (
    <div>
      <PageHeader title="Receipt template" description="Applies to printed, PDF and emailed receipts." />
      <ReceiptEditor
        initial={ctx.settings.receipt}
        businessName={ctx.tenant.name}
        locationName={loc?.name ?? ""}
        address={loc?.address ?? ""}
        currency={ctx.currency}
        timeZone={ctx.timezone}
      />
    </div>
  );
}
