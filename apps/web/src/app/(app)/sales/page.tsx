import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th } from "@unipos/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateTime, money, ymd, zonedToUtc } from "@/lib/format";
import { LocalSales } from "./local-sales";

export const metadata = { title: "Sales" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireContext("sales.view");
  const t = await getTranslations("nav");
  const sp = await searchParams;
  const today = ymd(new Date(), ctx.timezone);
  const from = sp.from || ymd(new Date(Date.now() - 6 * 86400_000), ctx.timezone);
  const to = sp.to || today;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = {
    createdAt: { gte: zonedToUtc(`${from}T00:00:00`, ctx.timezone), lt: new Date(zonedToUtc(`${to}T00:00:00`, ctx.timezone).getTime() + 86400_000) },
    ...(sp.status === "refunds" ? { isRefund: true } : sp.status === "voided" ? { status: "voided" } : sp.status === "flagged" ? { flags: { isEmpty: false } } : {}),
    ...(sp.q ? { OR: [{ number: { contains: sp.q, mode: "insensitive" as const } }, { customer: { name: { contains: sp.q, mode: "insensitive" as const } } }] } : {}),
    ...(sp.location === "all" ? {} : { locationId: ctx.locationId }),
  };
  const [sales, count, agg] = await read(ctx, (tx) =>
    Promise.all([
      tx.sale.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50, include: { customer: true, payments: true } }),
      tx.sale.count({ where }),
      tx.sale.aggregate({ where: { ...where, status: "completed" }, _sum: { total: true } }),
    ]),
  );
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  const qs = (patch: Record<string, string | number>) => new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v) as [string, string][]), ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) }).toString();
  return (
    <div>
      <PageHeader title={t("sales")} description={`${count} sales · ${m(agg._sum.total ?? 0)} net`} />
      <LocalSales tenantId={ctx.tenantId} currency={ctx.currency} />
      <Card className="mb-4 p-3">
        <form className="flex flex-wrap items-end gap-2" role="search">
          <label className="flex flex-col text-xs text-muted">
            From
            <Input type="date" name="from" defaultValue={from} className="w-40" />
          </label>
          <label className="flex flex-col text-xs text-muted">
            To
            <Input type="date" name="to" defaultValue={to} className="w-40" />
          </label>
          <label className="flex flex-col text-xs text-muted">
            Show
            <Select name="status" defaultValue={sp.status ?? ""} className="w-36">
              <option value="">All</option>
              <option value="refunds">Refunds</option>
              <option value="voided">Voided</option>
              <option value="flagged">Needs review</option>
            </Select>
          </label>
          {ctx.locations.length > 1 ? (
            <label className="flex flex-col text-xs text-muted">
              Location
              <Select name="location" defaultValue={sp.location ?? ""} className="w-36">
                <option value="">Current</option>
                <option value="all">All locations</option>
              </Select>
            </label>
          ) : null}
          <label className="flex flex-1 flex-col text-xs text-muted">
            Receipt or customer
            <Input name="q" defaultValue={sp.q ?? ""} placeholder="MAIN-…" />
          </label>
          <Button type="submit">Filter</Button>
        </form>
      </Card>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Receipt</Th>
              <Th>Date</Th>
              <Th>Cashier</Th>
              <Th>Customer</Th>
              <Th>Paid by</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <Td>
                  <Link href={`/sales/${s.id}`} className="font-medium text-primary underline">
                    {s.number}
                  </Link>{" "}
                  {s.isRefund ? <Badge tone="warning">Refund</Badge> : null} {s.status === "voided" ? <Badge tone="danger">Voided</Badge> : null}{" "}
                  {s.flags.length ? <Badge tone="danger">Review</Badge> : null}
                </Td>
                <Td>{dateTime(s.createdAt, ctx.timezone, ctx.locale)}</Td>
                <Td>{s.memberName}</Td>
                <Td>{s.customer?.name ?? "—"}</Td>
                <Td className="capitalize">{[...new Set(s.payments.map((p) => p.tender.replace("_", " ")))].join(", ")}</Td>
                <Td className="tabular text-right font-medium">{m(s.total)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!sales.length ? <EmptyState title="No sales in this period" /> : null}
        {count > 50 ? (
          <div className="flex justify-between p-3 text-sm">
            {page > 1 ? <Link className="text-primary underline" href={`/sales?${qs({ page: page - 1 })}`}>Previous</Link> : <span />}
            <span className="text-muted">
              Page {page} of {Math.ceil(count / 50)}
            </span>
            {page * 50 < count ? <Link className="text-primary underline" href={`/sales?${qs({ page: page + 1 })}`}>Next</Link> : <span />}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
