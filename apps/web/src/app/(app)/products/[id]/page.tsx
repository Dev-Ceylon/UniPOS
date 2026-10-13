import { can } from "@unipos/core";
import { Card, CardHeader, CardTitle, PageHeader, Table, Td, Th } from "@unipos/ui";
import { notFound } from "next/navigation";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateTime } from "@/lib/format";
import { formOptions } from "../load";
import { ProductForm, toFormData } from "../product-form";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("products.view");
  const { id } = await params;
  const data = await read(ctx, async (tx) => {
    const product = await tx.product.findUnique({ where: { id }, include: { variants: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } } });
    if (!product || product.deletedAt) return null;
    const movements = await tx.stockMovement.findMany({ where: { variantId: { in: product.variants.map((v) => v.id) } }, orderBy: { createdAt: "desc" }, take: 25 });
    return { product, movements, opts: await formOptions(ctx, tx) };
  });
  if (!data) notFound();
  const names = new Map(data.product.variants.map((v) => [v.id, v.name || "Default"]));
  const locs = new Map(ctx.locations.map((l) => [l.id, l.name]));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={data.product.name} />
      <ProductForm
        currency={ctx.currency}
        {...data.opts}
        customFieldDefs={ctx.settings.customFields.product}
        canDelete={can(ctx.member, "products.edit")}
        initial={toFormData(data.product, ctx.currency)}
      />
      {data.product.trackStock ? (
        <Card>
          <CardHeader>
            <CardTitle>Stock ledger (latest 25)</CardTitle>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Variant</Th>
                <Th>Location</Th>
                <Th>Reason</Th>
                <Th className="text-right">Change</Th>
              </tr>
            </thead>
            <tbody>
              {data.movements.map((mv) => (
                <tr key={mv.id}>
                  <Td>{dateTime(mv.createdAt, ctx.timezone, ctx.locale)}</Td>
                  <Td>{names.get(mv.variantId)}</Td>
                  <Td>{locs.get(mv.locationId) ?? "—"}</Td>
                  <Td className="capitalize">
                    {mv.reason.replace("_", " ")}
                    {mv.note ? <span className="text-muted"> · {mv.note}</span> : null}
                  </Td>
                  <Td className={`tabular text-right ${mv.qtyChange < 0 ? "text-danger" : "text-success"}`}>{mv.qtyChange > 0 ? `+${mv.qtyChange}` : mv.qtyChange}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
