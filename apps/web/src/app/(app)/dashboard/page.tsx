import { changeBp, inventoryValuation, isLowStock, salesByHour, salesByProduct, summarizeSales } from "@unipos/core";
import { loadReportSales } from "@unipos/db";
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Stat, Table, Td, Th } from "@unipos/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BarChart, RankBars } from "@/components/charts";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateTime, money, startOfDayInZone } from "@/lib/format";

export const metadata = { title: "Dashboard" };

function pct(bp: number | null) {
  if (bp === null) return "new";
  return `${bp >= 0 ? "▲" : "▼"} ${(Math.abs(bp) / 100).toFixed(1)}% vs yesterday`;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  const ctx = await requireContext("dashboard.view");
  const t = await getTranslations("nav");
  const sp = await searchParams;
  const now = new Date();
  const today = startOfDayInZone(now, ctx.timezone);
  const yesterday = new Date(today.getTime() - 86400_000);
  const m = (v: number) => money(v, ctx.currency, ctx.locale);

  const data = await read(ctx, async (tx) => {
    const [todaySales, ySales, recent, flagged, levels, shift] = await Promise.all([
      loadReportSales(tx, { from: today, to: new Date(today.getTime() + 86400_000), locationId: ctx.locationId }),
      loadReportSales(tx, { from: yesterday, to: today, locationId: ctx.locationId }),
      tx.sale.findMany({ where: { locationId: ctx.locationId }, orderBy: { createdAt: "desc" }, take: 8 }),
      tx.sale.findMany({
        where: { flags: { isEmpty: false }, createdAt: { gte: new Date(now.getTime() - 7 * 86400_000) } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      tx.stockLevel.findMany({ where: { locationId: ctx.locationId, reorderPoint: { gt: 0 } }, include: { variant: { include: { product: true } } } }),
      tx.shift.findFirst({ where: { locationId: ctx.locationId, closedAt: null } }),
    ]);
    return { todaySales, ySales, recent, flagged, levels, shift };
  });

  const s = summarizeSales(data.todaySales);
  const y = summarizeSales(data.ySales);
  const hours = salesByHour(data.todaySales, ctx.timezone).slice(6, 23);
  const top = salesByProduct(data.todaySales).slice(0, 6);
  const low = data.levels.filter((l) => !l.variant.deletedAt && isLowStock(l.onHand, l.reorderPoint));
  const valuation = inventoryValuation(
    data.levels.map((l) => ({
      variantId: l.variantId,
      name: l.variant.product.name,
      onHand: l.onHand,
      unitCost: l.variant.cost,
      price: l.variant.price,
      reorderPoint: l.reorderPoint,
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("dashboard")}
        description={`${ctx.locations.find((l) => l.id === ctx.locationId)?.name ?? ""} · ${dateTime(now, ctx.timezone, ctx.locale)}`}
      />
      {sp.module === "off" ? <Alert tone="warning">That module is turned off for this business. Enable it in Settings → Modules.</Alert> : null}
      {!data.shift ? (
        <Alert tone="warning" title="No open shift">
          Open a shift on the{" "}
          <Link className="underline" href="/shifts">
            Shifts
          </Link>{" "}
          page to track cash.
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Sales today" value={m(s.total)} sub={pct(changeBp(s.total, y.total))} tone={s.total >= y.total ? "success" : "danger"} />
        <Stat label="Transactions" value={s.saleCount} sub={pct(changeBp(s.saleCount, y.saleCount))} />
        <Stat label="Average sale" value={m(s.averageSale)} sub={`${s.itemsSold} items sold`} />
        <Stat label="Gross profit" value={m(s.profit)} sub={`${(s.marginBp / 100).toFixed(1)}% margin`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales by hour</CardTitle>
          </CardHeader>
          <CardBody>
            {s.saleCount ? (
              <BarChart label="Sales by hour today" data={hours.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}:00`, value: h.total }))} format={m} />
            ) : (
              <EmptyState title="No sales yet today" />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
          </CardHeader>
          <CardBody>
            {top.length ? (
              <RankBars data={top.map((p) => ({ label: `${p.name} ×${p.qty}`, value: p.total }))} format={m} />
            ) : (
              <EmptyState title="Nothing sold yet" />
            )}
          </CardBody>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent sales</CardTitle>
            <Link href="/sales" className="text-sm text-primary-ink underline">
              View all
            </Link>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>Receipt</Th>
                <Th>Time</Th>
                <Th>Cashier</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <Link className="text-primary-ink underline" href={`/sales/${r.id}`}>
                      {r.number}
                    </Link>{" "}
                    {r.isRefund ? <Badge tone="warning">Refund</Badge> : null}
                    {r.status === "voided" ? <Badge tone="danger">Void</Badge> : null}
                  </Td>
                  <Td>{dateTime(r.createdAt, ctx.timezone, ctx.locale)}</Td>
                  <Td>{r.memberName}</Td>
                  <Td className="tabular text-right">{m(r.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!data.recent.length ? <EmptyState title="No sales yet">Ring up your first sale on the register.</EmptyState> : null}
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Low stock</CardTitle>
              <Badge tone={low.length ? "warning" : "success"}>{low.length}</Badge>
            </CardHeader>
            <CardBody className="flex flex-col gap-1 text-sm">
              {low.slice(0, 6).map((l) => (
                <div key={l.id} className="flex justify-between">
                  <span className="truncate">{l.variant.product.name}</span>
                  <span className="tabular text-warning">{l.onHand}</span>
                </div>
              ))}
              {!low.length ? <p className="text-muted">All stock above reorder points.</p> : null}
              <p className="mt-2 text-xs text-muted">Stock value at cost: {m(valuation.costValue)}</p>
            </CardBody>
          </Card>
          {data.flagged.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Needs review</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-2 text-sm">
                {data.flagged.map((f) => (
                  <Link key={f.id} href={`/sales/${f.id}`} className="block">
                    <span className="text-primary-ink underline">{f.number}</span> <span className="text-muted">{f.flags.join(", ")}</span>
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
