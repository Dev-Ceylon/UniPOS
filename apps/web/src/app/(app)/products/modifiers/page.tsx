import { PageHeader } from "@unipos/ui";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { ModifierEditor } from "./editor";

export const metadata = { title: "Modifiers" };

export default async function ModifiersPage() {
  const ctx = await requireContext("restaurant.manage", "restaurant");
  const groups = await read(ctx, (tx) => tx.modifierGroup.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }));
  return (
    <div className="max-w-3xl">
      <PageHeader title="Modifier groups" description="Options such as spice level or extras. Attach groups to products on the product page." />
      <ModifierEditor currency={ctx.currency} groups={groups.map((g) => ({ id: g.id, name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, modifiers: g.modifiers as { name: string; priceDelta: number }[] }))} />
    </div>
  );
}
