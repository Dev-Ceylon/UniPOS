import { can, type TaxLine } from "@unipos/core";
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle, PageHeader, Table, Td, Th } from "@unipos/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateTime, money } from "@/lib/format";
import { SaleActions } from "./sale-actions";

export default async function SaleDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("sales.view");
  const { id } = await params;
  const sale = await read(ctx, (tx) =>
    tx.sale.findUnique({
      where: { id },
      include: { lines: true, payments: true, customer: true, refunds: { include: { lines: true } }, originalSale: true },
    }),
  );
  if (!sale) notFound();
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  const refunded = new Map<string, number>();
  for (const r of sale.refunds.filter((x) => x.status === "completed"))
    for (const l of r.lines) if (l.originalLineId) refunded.set(l.originalLineId, (refunded.get(l.originalLineId) ?? 0) - l.qty);
  const location = ctx.locations.find((l) => l.id === sale.locationId);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {sale.isRefund ? "Refund" : "Sale"} {sale.number}
            {sale.status === "voided" ? <Badge tone="danger">Voided</Badge> : null}
          </span>
        }
        description={`${dateTime(sale.createdAt, ctx.timezone, ctx.locale)} · ${location?.name ?? ""} · ${sale.memberName}${sale.tableName ? ` · Table ${sale.tableName}` : ""}`}
        actions={
          <SaleActions
            sale={{ id: sale.id, isRefund: sale.isRefund, status: sale.status, flagged: sale.flags.length > 0, customerEmail: sale.customer?.email ?? "" }}
            lines={sale.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, refundable: l.qty - (refunded.get(l.id) ?? 0), total: l.total }))}
            canRefund={can(ctx.member, "sales.refund") && sale.status === "completed" && !sale.isRefund}
            canVoid={can(ctx.member, "sales.void") && sale.status === "completed" && !sale.isRefund && sale.refunds.length === 0}
            currency={ctx.currency}
            hasGiftCards={ctx.tenant.modules.includes("giftcards")}
          />
        }
      />
      {sale.flags.length ? (
        <Alert tone="danger" title="Needs review">
          {sale.flags.map((f) => (
            <p key={f}>{f.replace(/_/g, " ")}</p>
          ))}
        </Alert>
      ) : null}
      {sale.status === "voided" ? <Alert tone="danger">Voided: {sale.voidReason}</Alert> : null}
      {sale.originalSale ? (
        <Alert>
          Refund of{" "}
          <Link className="text-primary-ink underline" href={`/sales/${sale.originalSale.id}`}>
            {sale.originalSale.number}
          </Link>
          {sale.note ? ` — ${sale.note}` : ""}
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Discount</Th>
                <Th className="text-right">Tax</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {sale.lines.map((l) => (
                <tr key={l.id}>
                  <Td>
                    {l.name}
                    {(l.modifiers as { name: string }[]).length ? (
                      <p className="text-xs text-muted">{(l.modifiers as { name: string }[]).map((x) => x.name).join(", ")}</p>
                    ) : null}
                    {l.catalogPrice !== null && l.catalogPrice !== l.unitPrice ? (
                      <p className="text-xs text-warning">Price changed from {m(l.catalogPrice)}</p>
                    ) : null}
                    {refunded.get(l.id) ? <p className="text-xs text-warning">{refunded.get(l.id)} refunded</p> : null}
                  </Td>
                  <Td className="tabular text-right">{l.qty}</Td>
                  <Td className="tabular text-right">{m(l.unitPrice)}</Td>
                  <Td className="tabular text-right">{l.lineDiscount + l.orderDiscount ? m(l.lineDiscount + l.orderDiscount) : "—"}</Td>
                  <Td className="tabular text-right">{m(l.taxTotal)}</Td>
                  <Td className="tabular text-right font-medium">{m(l.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <CardBody className="flex flex-col items-end gap-1 text-sm">
            <p>Subtotal {m(sale.subtotal)}</p>
            {sale.discountTotal ? <p>Discount −{m(sale.discountTotal)}</p> : null}
            {(sale.taxes as unknown as TaxLine[]).map((t) => (
              <p key={t.ruleId} className="text-muted">
                {t.name} {t.rateBp / 100}%{t.inclusive ? " incl." : ""} {m(t.amount)}
              </p>
            ))}
            <p className="text-lg font-bold">Total {m(sale.total)}</p>
          </CardBody>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-1 text-sm">
              {sale.payments.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span className="capitalize">
                    {p.tender.replace("_", " ")} {p.reference ? <span className="text-muted">· {p.reference}</span> : null}
                  </span>
                  <span className="tabular">{m(p.amount)}</span>
                </div>
              ))}
              {sale.change ? <p className="text-muted">Change given {m(sale.change)}</p> : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardBody className="text-sm">
              {sale.customer ? (
                <Link className="text-primary-ink underline" href={`/customers/${sale.customer.id}`}>
                  {sale.customer.name}
                </Link>
              ) : (
                "Walk-in"
              )}
            </CardBody>
          </Card>
          {sale.refunds.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Refunds</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-1 text-sm">
                {sale.refunds.map((r) => (
                  <Link key={r.id} href={`/sales/${r.id}`} className="flex justify-between text-primary-ink underline">
                    <span>{r.number}</span>
                    <span className="tabular">{m(r.total)}</span>
                  </Link>
                ))}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
