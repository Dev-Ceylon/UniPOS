import { can, currencyExponent } from "@unipos/core";
import { shiftTotals } from "@unipos/db";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Table, Td, Th } from "@unipos/ui";
import { getTranslations } from "next-intl/server";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateTime, money } from "@/lib/format";
import { CashUp, OpenShift } from "./shift-forms";

export const metadata = { title: "Shifts" };

/** Note and coin denominations in minor units, by currency. */
function denominations(currency: string): number[] {
  const lk = [500000, 100000, 50000, 10000, 5000, 2000, 1000, 500, 200, 100];
  const generic = [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5, 1];
  if (currency === "LKR") return lk;
  if (currencyExponent(currency) === 0) return [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];
  return generic;
}

export default async function ShiftsPage() {
  const ctx = await requireContext("shifts.manage");
  const t = await getTranslations("nav");
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  const { open, totals, history } = await read(ctx, async (tx) => {
    const open = await tx.shift.findFirst({ where: { locationId: ctx.locationId, closedAt: null } });
    const totals = open ? await shiftTotals(tx, open.id) : null;
    const history = await tx.shift.findMany({
      where: { locationId: ctx.locationId, closedAt: { not: null }, ...(can(ctx.member, "shifts.view_all") ? {} : { memberId: ctx.member.id }) },
      orderBy: { closedAt: "desc" },
      take: 30,
    });
    return { open, totals, history };
  });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("shifts")} description="Opening float, cash in/out and end-of-day cash-up with variance." />
      {!open || !totals ? (
        <Card className="max-w-md p-4">
          <OpenShift currency={ctx.currency} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Current shift</CardTitle>
              <Badge tone="success">Open since {dateTime(open.openedAt, ctx.timezone, ctx.locale)}</Badge>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted">Opening float</dt>
                <dd className="tabular text-right">{m(open.openingFloat)}</dd>
                <dt className="text-muted">Cash sales</dt>
                <dd className="tabular text-right">{m(totals.cashSales)}</dd>
                <dt className="text-muted">Cash refunds</dt>
                <dd className="tabular text-right">−{m(totals.cashRefunds)}</dd>
                <dt className="text-muted">Cash in</dt>
                <dd className="tabular text-right">{m(totals.cashIn)}</dd>
                <dt className="text-muted">Cash out</dt>
                <dd className="tabular text-right">−{m(totals.cashOut)}</dd>
                <dt className="font-semibold">Expected in drawer</dt>
                <dd className="tabular text-right font-semibold" data-testid="expected-cash">
                  {m(totals.expected)}
                </dd>
              </dl>
              <h3 className="mt-4 mb-1 text-sm font-semibold">Takings by tender</h3>
              <dl className="grid grid-cols-2 gap-1 text-sm">
                {totals.byTender.map((b) => (
                  <div key={b.tender} className="contents">
                    <dt className="capitalize text-muted">{b.tender.replace("_", " ")}</dt>
                    <dd className="tabular text-right">{m(b.amount)}</dd>
                  </div>
                ))}
                <dt className="text-muted">Sales</dt>
                <dd className="tabular text-right">{totals.salesCount}</dd>
              </dl>
              {totals.movements.length ? (
                <>
                  <h3 className="mt-4 mb-1 text-sm font-semibold">Cash movements</h3>
                  <ul className="text-sm">
                    {totals.movements.map((mv) => (
                      <li key={mv.id} className="flex justify-between">
                        <span>
                          {mv.type === "in" ? "In" : "Out"} · {mv.reason}
                        </span>
                        <span className="tabular">{m(mv.type === "in" ? mv.amount : -mv.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cash in / out and cash-up</CardTitle>
            </CardHeader>
            <CardBody>
              <CashUp shiftId={open.id} currency={ctx.currency} denominations={denominations(ctx.currency)} expected={totals.expected} />
            </CardBody>
          </Card>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Closed shifts</CardTitle>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>Opened</Th>
              <Th>Closed</Th>
              <Th className="text-right">Expected</Th>
              <Th className="text-right">Counted</Th>
              <Th className="text-right">Variance</Th>
            </tr>
          </thead>
          <tbody>
            {history.map((s) => (
              <tr key={s.id}>
                <Td>{dateTime(s.openedAt, ctx.timezone, ctx.locale)}</Td>
                <Td>{s.closedAt ? dateTime(s.closedAt, ctx.timezone, ctx.locale) : ""}</Td>
                <Td className="tabular text-right">{m(s.expectedCash ?? 0)}</Td>
                <Td className="tabular text-right">{m(s.countedCash ?? 0)}</Td>
                <Td
                  className={`tabular text-right font-medium ${(s.variance ?? 0) < 0 ? "text-danger" : (s.variance ?? 0) > 0 ? "text-warning" : "text-success"}`}
                >
                  {m(s.variance ?? 0)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!history.length ? <EmptyState title="No closed shifts yet" /> : null}
      </Card>
    </div>
  );
}
