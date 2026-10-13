import { can, inventoryValuation, isLowStock } from "@unipos/core";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Stat, Table, Td, Th } from "@unipos/ui";
import { getTranslations } from "next-intl/server";
import { LinkButton } from "@/components/link-button";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { money } from "@/lib/format";
import { AdjustButton, ReorderInput } from "./row-actions";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const ctx = await requireContext("inventory.view", "inventory");
  const t = await getTranslations("nav");
  const sp = await searchParams;
  const variants = await read(ctx, (tx) =>
    tx.variant.findMany({
      where: {
        deletedAt: null,
        product: { deletedAt: null, trackStock: true, ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" } } : {}) },
      },
      include: { product: { include: { category: true } }, stockLevels: { where: { locationId: ctx.locationId } } },
      orderBy: { product: { name: "asc" } },
      take: 500,
    }),
  );
  let rows = variants.map((v) => ({ v, onHand: v.stockLevels[0]?.onHand ?? 0, reorder: v.stockLevels[0]?.reorderPoint ?? null }));
  const valuation = inventoryValuation(rows.map((r) => ({ variantId: r.v.id, name: r.v.product.name, onHand: r.onHand, unitCost: r.v.cost, price: r.v.price, reorderPoint: r.reorder })));
  if (sp.filter === "low") rows = rows.filter((r) => isLowStock(r.onHand, r.reorder));
  if (sp.filter === "negative") rows = rows.filter((r) => r.onHand < 0);
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  const canAdjust = can(ctx.member, "inventory.adjust");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("inventory")}
        description={ctx.locations.find((l) => l.id === ctx.locationId)?.name}
        actions={
          <>
            {can(ctx.member, "inventory.stocktake") ? <LinkButton href="/inventory/stocktakes">Stocktakes</LinkButton> : null}
            {ctx.tenant.modules.includes("multilocation") && can(ctx.member, "inventory.transfer") ? <LinkButton href="/inventory/transfers">Transfers</LinkButton> : null}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Stock items" value={valuation.skus} />
        <Stat label="Units on hand" value={valuation.units} />
        <Stat label="Value at cost" value={m(valuation.costValue)} />
        <Stat label="Low stock" value={valuation.lowStockCount} tone={valuation.lowStockCount ? "danger" : "success"} sub={`Retail value ${m(valuation.retailValue)}`} />
      </div>
      <Card className="p-3">
        <form className="flex flex-wrap gap-2" role="search">
          <Input name="q" defaultValue={sp.q} placeholder="Product name" aria-label="Search" className="max-w-sm" />
          <Select name="filter" defaultValue={sp.filter ?? ""} aria-label="Filter" className="w-44">
            <option value="">All items</option>
            <option value="low">Low stock</option>
            <option value="negative">Negative stock</option>
          </Select>
          <Button type="submit">Filter</Button>
        </form>
      </Card>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>SKU</Th>
              <Th className="text-right">On hand</Th>
              <Th className="text-right">Reorder at</Th>
              <Th className="text-right">Value</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ v, onHand, reorder }) => (
              <tr key={v.id}>
                <Td>
                  {v.product.name}
                  {v.name ? <span className="text-muted"> — {v.name}</span> : null}{" "}
                  {onHand < 0 ? <Badge tone="danger">Negative</Badge> : isLowStock(onHand, reorder) ? <Badge tone="warning">Low</Badge> : null}
                </Td>
                <Td className="text-xs text-muted">{v.sku}</Td>
                <Td className={`tabular text-right font-medium ${onHand < 0 ? "text-danger" : ""}`}>{onHand}</Td>
                <Td className="text-right">{canAdjust ? <ReorderInput variantId={v.id} value={reorder} /> : (reorder ?? "—")}</Td>
                <Td className="tabular text-right">{m(Math.max(0, onHand) * v.cost)}</Td>
                <Td className="text-right">{canAdjust ? <AdjustButton variantId={v.id} name={v.product.name + (v.name ? ` — ${v.name}` : "")} onHand={onHand} /> : null}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!rows.length ? <EmptyState title="Nothing to show">Products with stock tracking appear here.</EmptyState> : null}
      </Card>
    </div>
  );
}
