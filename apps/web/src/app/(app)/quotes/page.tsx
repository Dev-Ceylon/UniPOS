import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@unipos/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateOnly, money } from "@/lib/format";
import { NewQuote } from "./new-quote";

export const metadata = { title: "Quotations" };

export default async function QuotesPage() {
  const ctx = await requireContext("quotes.manage", "quotes");
  const t = await getTranslations("nav");
  const quotes = await read(ctx, (tx) => tx.quote.findMany({ orderBy: { createdAt: "desc" }, take: 100 }));
  const custIds = quotes.map((q) => q.customerId).filter(Boolean) as string[];
  const customers = await read(ctx, (tx) => tx.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } }));
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("quotes")} description="Quotes keep their prices and open in the register to become a sale." actions={<NewQuote currency={ctx.currency} hasCustomers={ctx.tenant.modules.includes("customers")} />} />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Number</Th>
              <Th>Customer</Th>
              <Th>Valid until</Th>
              <Th>Status</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <Td>
                  <Link className="text-primary underline" href={`/quotes/${q.id}`}>
                    {q.number}
                  </Link>
                </Td>
                <Td>{q.customerId ? names.get(q.customerId) : "—"}</Td>
                <Td>{q.validUntil ? dateOnly(q.validUntil, ctx.timezone, ctx.locale) : "—"}</Td>
                <Td>
                  <Badge tone={q.status === "converted" ? "success" : q.status === "expired" ? "danger" : q.status === "accepted" ? "primary" : "neutral"}>{q.status}</Badge>
                </Td>
                <Td className="tabular text-right">{m(q.total)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!quotes.length ? <EmptyState title="No quotations yet" /> : null}
      </Card>
    </div>
  );
}
