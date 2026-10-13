import { PageHeader } from "@unipos/ui";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { TaxEditor } from "./editor";

export const metadata = { title: "Taxes" };

export default async function TaxesPage() {
  const ctx = await requireContext("settings.edit");
  const classes = await read(ctx, (tx) =>
    tx.taxClass.findMany({ where: { deletedAt: null }, include: { rules: { orderBy: { priority: "asc" } } }, orderBy: { name: "asc" } }),
  );
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Tax classes"
        description="Each product has one tax class. A class holds one or more rules: inclusive (already in the price) or exclusive (added at checkout), optionally compound (tax on tax) and limited to a region."
      />
      <TaxEditor
        classes={classes.map((c) => ({
          id: c.id,
          name: c.name,
          rules: c.rules.map((r) => ({
            id: r.id,
            name: r.name,
            rate: String(r.rateBp / 100),
            inclusive: r.inclusive,
            compound: r.compound,
            region: r.region ?? "",
            priority: r.priority,
          })),
        }))}
      />
    </div>
  );
}
