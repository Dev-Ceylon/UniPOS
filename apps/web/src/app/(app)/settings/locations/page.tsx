import { can } from "@unipos/core";
import { PageHeader } from "@unipos/ui";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { LocationsEditor } from "./editor";

export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  const ctx = await requireContext("settings.view");
  const locations = await read(ctx, (tx) => tx.location.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } }));
  return (
    <div>
      <PageHeader title="Locations" description="Each location has its own stock, receipt header and tax region." />
      <LocationsEditor
        canEdit={can(ctx.member, "settings.edit")}
        locations={locations.map((l) => ({ id: l.id, name: l.name, code: l.code, address: l.address ?? "", phone: l.phone ?? "", receiptHeader: l.receiptHeader ?? "", taxRegion: l.taxRegion ?? "" }))}
      />
    </div>
  );
}
