import { can } from "@unipos/core";
import { loyaltyBalance } from "@unipos/db";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Stat, Table, Td, Th } from "@unipos/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateTime, money } from "@/lib/format";
import { CustomerForm } from "../customer-form";
import { PointsAdjust, PrivacyActions } from "./customer-actions";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("customers.view", "customers");
  const { id } = await params;
  const data = await read(ctx, async (tx) => {
    const c = await tx.customer.findUnique({ where: { id } });
    if (!c || c.deletedAt) return null;
    const [sales, agg, points, ledger, cards] = await Promise.all([
      tx.sale.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
      tx.sale.aggregate({ where: { customerId: id, status: "completed" }, _sum: { total: true }, _count: true }),
      loyaltyBalance(tx, id),
      tx.loyaltyEntry.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
      tx.giftCard.findMany({ where: { customerId: id } }),
    ]);
    return { c, sales, agg, points, ledger, cards };
  });
  if (!data) notFound();
  const { c } = data;
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  const loyalty = ctx.tenant.modules.includes("loyalty");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={c.name}
        description={[c.phone, c.email, c.group].filter(Boolean).join(" · ")}
        actions={
          <>
            {can(ctx.member, "customers.edit") ? (
              <CustomerForm
                customer={{
                  id: c.id,
                  name: c.name,
                  phone: c.phone ?? "",
                  email: c.email ?? "",
                  group: c.group ?? "",
                  notes: c.notes ?? "",
                  marketingConsent: c.marketingConsent,
                  customFields: (c.customFields as Record<string, unknown>) ?? {},
                }}
                customFields={ctx.settings.customFields.customer}
              />
            ) : null}
            {can(ctx.member, "customers.privacy") ? <PrivacyActions id={c.id} /> : null}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Lifetime spend" value={m(data.agg._sum.total ?? 0)} />
        <Stat label="Visits" value={data.agg._count} />
        {loyalty ? (
          <Stat label="Loyalty points" value={data.points} sub={`Worth ${m(data.points * ctx.settings.loyalty.pointValue)}`} />
        ) : (
          <Stat label="Customer since" value={dateTime(c.createdAt, ctx.timezone, ctx.locale)} />
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Purchase history</CardTitle>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>Receipt</Th>
                <Th>Date</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {data.sales.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <Link className="text-primary-ink underline" href={`/sales/${s.id}`}>
                      {s.number}
                    </Link>{" "}
                    {s.isRefund ? <Badge tone="warning">Refund</Badge> : null}
                  </Td>
                  <Td>{dateTime(s.createdAt, ctx.timezone, ctx.locale)}</Td>
                  <Td className="tabular text-right">{m(s.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!data.sales.length ? <EmptyState title="No purchases yet" /> : null}
        </Card>
        <div className="flex flex-col gap-4">
          {c.notes ? (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardBody className="whitespace-pre-wrap text-sm">{c.notes}</CardBody>
            </Card>
          ) : null}
          {Object.keys((c.customFields as object) ?? {}).length ? (
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardBody className="text-sm">
                {ctx.settings.customFields.customer.map((d) => (
                  <p key={d.key}>
                    <span className="text-muted">{d.label}:</span> {String((c.customFields as Record<string, unknown>)[d.key] ?? "—")}
                  </p>
                ))}
              </CardBody>
            </Card>
          ) : null}
          {loyalty ? (
            <Card>
              <CardHeader>
                <CardTitle>Points history</CardTitle>
                {can(ctx.member, "customers.edit") ? <PointsAdjust customerId={c.id} /> : null}
              </CardHeader>
              <CardBody className="flex flex-col gap-1 text-sm">
                {data.ledger.map((e) => (
                  <div key={e.id} className="flex justify-between">
                    <span className="capitalize">{e.reason}</span>
                    <span className={`tabular ${e.points < 0 ? "text-danger" : "text-success"}`}>{e.points > 0 ? `+${e.points}` : e.points}</span>
                  </div>
                ))}
                {!data.ledger.length ? <p className="text-muted">No points yet.</p> : null}
              </CardBody>
            </Card>
          ) : null}
          {data.cards.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Gift cards</CardTitle>
              </CardHeader>
              <CardBody className="text-sm">
                {data.cards.map((g) => (
                  <p key={g.id} className="flex justify-between">
                    <span className="font-mono">{g.code}</span>
                    <span>{m(g.balance)}</span>
                  </p>
                ))}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
