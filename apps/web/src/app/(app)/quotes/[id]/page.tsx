import { computeCart, type CartLineInput } from "@unipos/core";
import { Badge, Card, CardBody, PageHeader, Table, Td, Th } from "@unipos/ui";
import { notFound } from "next/navigation";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateOnly, money } from "@/lib/format";
import { QuoteActions } from "./quote-actions";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("quotes.manage", "quotes");
  const { id } = await params;
  const data = await read(ctx, async (tx) => {
    const q = await tx.quote.findUnique({ where: { id } });
    if (!q) return null;
    const customer = q.customerId ? await tx.customer.findUnique({ where: { id: q.customerId } }) : null;
    return { q, customer };
  });
  if (!data) notFound();
  const { q, customer } = data;
  const lines = q.lines as unknown as (CartLineInput & { catalogPrice: number; unitCost: number })[];
  const totals = computeCart({ lines });
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Quotation ${q.number}`}
        description={`${customer?.name ?? "No customer"}${q.validUntil ? ` · valid until ${dateOnly(q.validUntil, ctx.timezone, ctx.locale)}` : ""}`}
        actions={
          <>
            <Badge>{q.status}</Badge>
            <QuoteActions
              tenantId={ctx.tenantId}
              locationId={ctx.locationId}
              quote={{ id: q.id, status: q.status, saleId: q.saleId, customerId: q.customerId, customerName: customer?.name ?? null, lines }}
            />
          </>
        }
      />
      <Card className="print-area">
        <CardBody>
          <div className="mb-4 flex justify-between">
            <div>
              <p className="text-lg font-bold">{ctx.tenant.name}</p>
              <p className="text-sm">{ctx.locations.find((l) => l.id === q.locationId)?.name}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">Quotation {q.number}</p>
              <p>{dateOnly(q.createdAt, ctx.timezone, ctx.locale)}</p>
              {customer ? <p>For: {customer.name}</p> : null}
            </div>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {totals.lines.map((l) => (
                <tr key={l.id}>
                  <Td>{l.name}</Td>
                  <Td className="tabular text-right">{l.qty}</Td>
                  <Td className="tabular text-right">{m(l.unitPrice)}</Td>
                  <Td className="tabular text-right">{m(l.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-3 flex flex-col items-end text-sm">
            {totals.taxes.map((t) => (
              <p key={t.ruleId}>
                {t.name} {t.rateBp / 100}%{t.inclusive ? " incl." : ""}: {m(t.amount)}
              </p>
            ))}
            <p className="text-lg font-bold">Total {m(totals.total)}</p>
          </div>
          {q.note ? <p className="mt-4 whitespace-pre-wrap text-sm">{q.note}</p> : null}
        </CardBody>
      </Card>
    </div>
  );
}
