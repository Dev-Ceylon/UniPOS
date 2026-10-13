import { Card, CardBody, CardHeader, CardTitle, EmptyState, Input, PageHeader, Table, Td, Th } from "@unipos/ui";
import { getTranslations } from "next-intl/server";
import { RankBars } from "@/components/charts";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateOnly, money, ymd } from "@/lib/format";
import { DeleteExpense, NewExpense } from "./forms";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requireContext("expenses.manage", "expenses");
  const t = await getTranslations("nav");
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : ymd(new Date(), ctx.timezone).slice(0, 7);
  const from = new Date(`${month}-01T00:00:00Z`);
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 1);
  const expenses = await read(ctx, (tx) => tx.expense.findMany({ where: { date: { gte: from, lt: to } }, orderBy: { date: "desc" } }));
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const total = expenses.reduce((a, e) => a + e.amount, 0);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("expenses")} description={`${month}: ${m(total)}`} actions={<NewExpense currency={ctx.currency} categories={[...byCat.keys()]} />} />
      <form className="flex gap-2">
        <Input type="month" name="month" defaultValue={month} className="w-48" aria-label="Month" />
        <button className="rounded bg-primary px-3 text-sm text-primary-fg">Show</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Category</Th>
                <Th>Description</Th>
                <Th>Reference</Th>
                <Th className="text-right">Amount</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <Td>{dateOnly(e.date, "UTC", ctx.locale)}</Td>
                  <Td>{e.category}</Td>
                  <Td>{e.description}</Td>
                  <Td>{e.reference}</Td>
                  <Td className="tabular text-right">{m(e.amount)}</Td>
                  <Td className="text-right">
                    <DeleteExpense id={e.id} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!expenses.length ? <EmptyState title="No expenses this month" /> : null}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardBody>
            {byCat.size ? (
              <RankBars data={[...byCat].map(([label, value]) => ({ label, value }))} format={m} />
            ) : (
              <p className="text-sm text-muted">Nothing yet.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
