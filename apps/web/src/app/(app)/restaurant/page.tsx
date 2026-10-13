import { PageHeader } from "@unipos/ui";
import { LinkButton } from "@/components/link-button";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { FloorPlan } from "./floor-plan";

export const metadata = { title: "Tables" };

export default async function RestaurantPage() {
  const ctx = await requireContext("restaurant.manage", "restaurant");
  const tables = await read(ctx, (tx) =>
    tx.diningTable.findMany({ where: { locationId: ctx.locationId, deletedAt: null }, include: { tab: true }, orderBy: { name: "asc" } }),
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Floor plan"
        description="Drag tables to match your room. Occupied tables show their open bill."
        actions={
          <>
            <LinkButton href="/products/modifiers">Modifiers</LinkButton>
            <LinkButton href="/kitchen">Kitchen display</LinkButton>
          </>
        }
      />
      <FloorPlan
        tables={tables.map((t) => ({
          id: t.id,
          name: t.name,
          seats: t.seats,
          area: t.area,
          shape: t.shape,
          x: t.x,
          y: t.y,
          occupied: !!t.tab && (t.tab.lines as unknown[]).length > 0,
          covers: t.tab?.covers ?? 0,
        }))}
      />
    </div>
  );
}
