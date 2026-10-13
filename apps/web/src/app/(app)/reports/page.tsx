import { can, salesByDay, salesByHour, summarizeSales } from "@unipos/core";
import { Button, Card, CardBody, CardHeader, CardTitle, EmptyState, Input, PageHeader, Select, Stat, Table, Td, Th } from "@unipos/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BarChart } from "@/components/charts";
import { LinkButton } from "@/components/link-button";
import { requireContext } from "@/lib/context";
import { money } from "@/lib/format";
import { buildReport, loadSales, parseRange, REPORT_TYPES, type ReportType } from "@/lib/reports";

export const metadata = { title: "Reports" };

const LABELS: Record<ReportType, string> = { sales: "Sales", products: "Products & profit", categories: "Categories", staff: "Staff", tax: "Tax", tenders: "Tenders", inventory: "Inventory" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireContext("reports.view", "reports");
  const t = await getTranslations("nav");
  const sp = await searchParams;
  const type = (REPORT_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as ReportType) : "sales";
  const range = parseRange(ctx, sp as Record<string, string>);
  const [table, sales] = await Promise.all([buildReport(ctx, type, range), loadSales(ctx, range)]);
  const s = summarizeSales(sales);
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  const qs = (extra: Record<string, string>) => new URLSearchParams({ from: range.from, to: range.to, location: range.locationId ?? "all", type, ...extra }).toString();
  const days = salesByDay(sales, ctx.timezone);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("reports")}
        actions={
          can(ctx.member, "reports.export") ? (
            <>
              <LinkButton href={`/api/v1/reports/export?${qs({ format: "csv" })}`}>Export CSV</LinkButton>
              <LinkButton href={`/api/v1/reports/export?${qs({ format: "pdf" })}`}>Export PDF</LinkButton>
            </>
          ) : null
        }
      />
      <Card className="p-3">
        <form className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="type" value={type} />
          <label className="flex flex-col text-xs text-muted">
            From
            <Input type="date" name="from" defaultValue={range.from} className="w-40" />
          </label>
          <label className="flex flex-col text-xs text-muted">
            To
            <Input type="date" name="to" defaultValue={range.to} className="w-40" />
          </label>
          <label className="flex flex-col text-xs text-muted">
            Location
            <Select name="location" defaultValue={range.locationId ?? "all"} className="w-44">
              <option value="all">All locations</option>
              {ctx.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit">Apply</Button>
        </form>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Net sales (incl. tax)" value={m(s.total)} sub={`${s.saleCount} sales · avg ${m(s.averageSale)}`} />
        <Stat label="Discounts" value={m(s.discounts)} />
        <Stat label="Tax" value={m(s.tax)} />
        <Stat label="Refunds" value={m(s.refunds)} sub={`${s.refundCount} refunds`} />
        <Stat label="Gross profit" value={m(s.profit)} sub={`${(s.marginBp / 100).toFixed(1)}% margin on ${m(s.net)} net`} />
      </div>
      {days.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Daily sales</CardTitle>
          </CardHeader>
          <CardBody>
            <BarChart label="Daily sales" data={days.map((d) => ({ label: d.day.slice(5), value: d.total }))} format={m} />
          </CardBody>
        </Card>
      ) : days.length === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sales by hour</CardTitle>
          </CardHeader>
          <CardBody>
            <BarChart label="Sales by hour" data={salesByHour(sales, ctx.timezone).slice(6, 23).map((h) => ({ label: `${h.hour}:00`, value: h.total }))} format={m} />
          </CardBody>
        </Card>
      ) : null}
      <nav className="flex flex-wrap gap-2" aria-label="Report type">
        {REPORT_TYPES.map((rt) => (
          <Link
            key={rt}
            href={`/reports?${qs({ type: rt })}`}
            aria-current={rt === type ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${rt === type ? "bg-primary text-primary-fg" : "bg-surface-2 hover:bg-border/60"}`}
          >
            {LABELS[rt]}
          </Link>
        ))}
      </nav>
      <Card>
        <CardHeader>
          <CardTitle>{table.title}</CardTitle>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              {table.columns.map((c) => (
                <Th key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                  {c.label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i}>
                {table.columns.map((c) => (
                  <Td key={c.key} className={c.align === "right" ? "tabular text-right" : undefined}>
                    {c.money && typeof r[c.key] === "number" ? m(r[c.key] as number) : r[c.key]}
                  </Td>
                ))}
              </tr>
            ))}
            {table.totals ? (
              <tr className="font-semibold">
                {table.columns.map((c) => (
                  <Td key={c.key} className={c.align === "right" ? "tabular text-right" : undefined}>
                    {c.money && typeof table.totals![c.key] === "number" ? m(table.totals![c.key] as number) : table.totals![c.key]}
                  </Td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </Table>
        {!table.rows.length ? <EmptyState title="No data for this period" /> : null}
      </Card>
    </div>
  );
}
