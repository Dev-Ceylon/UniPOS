import { Badge, Card, CardBody, PageHeader, Table, Td, Th } from "@unipos/ui";
import { notFound } from "next/navigation";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateOnly, money } from "@/lib/format";
import { PoActions } from "./po-actions";

export default async function PoPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("purchasing.manage", "purchasing");
  const { id } = await params;
  const po = await read(ctx, (tx) => tx.purchaseOrder.findUnique({ where: { id }, include: { lines: true, supplier: true } }));
  if (!po) notFound();
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Purchase order ${po.number}`}
        description={`${po.supplier.name} · deliver to ${ctx.locations.find((l) => l.id === po.locationId)?.name ?? "—"}${po.expectedAt ? ` · expected ${dateOnly(po.expectedAt, ctx.timezone, ctx.locale)}` : ""}`}
        actions={
          <>
            <Badge tone={po.status === "received" ? "success" : po.status === "partial" ? "warning" : "neutral"}>{po.status}</Badge>
            <PoActions id={po.id} status={po.status} lines={po.lines.map((l) => ({ id: l.id, name: l.name, remaining: l.qtyOrdered - l.qtyReceived }))} />
          </>
        }
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th className="text-right">Ordered</Th>
              <Th className="text-right">Received</Th>
              <Th className="text-right">Unit cost</Th>
              <Th className="text-right">Line total</Th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => (
              <tr key={l.id}>
                <Td>{l.name}</Td>
                <Td className="tabular text-right">{l.qtyOrdered}</Td>
                <Td className="tabular text-right">{l.qtyReceived}</Td>
                <Td className="tabular text-right">{m(l.unitCost)}</Td>
                <Td className="tabular text-right">{m(l.unitCost * l.qtyOrdered)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <CardBody className="text-right font-semibold">Total {m(po.total)}</CardBody>
      </Card>
      {po.note ? <p className="text-sm text-muted">Note: {po.note}</p> : null}
    </div>
  );
}
