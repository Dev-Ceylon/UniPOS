import { can } from "@unipos/core";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Table, Td, Th } from "@unipos/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { money } from "@/lib/format";
import { CustomerForm } from "./customer-form";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const ctx = await requireContext("customers.view", "customers");
  const t = await getTranslations("nav");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = {
    deletedAt: null,
    ...(sp.q
      ? {
          OR: [
            { name: { contains: sp.q, mode: "insensitive" as const } },
            { phone: { contains: sp.q } },
            { email: { contains: sp.q, mode: "insensitive" as const } },
            { group: { contains: sp.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [customers, count] = await read(ctx, (tx) =>
    Promise.all([tx.customer.findMany({ where, orderBy: { name: "asc" }, take: 50, skip: (page - 1) * 50 }), tx.customer.count({ where })]),
  );
  const ids = customers.map((c) => c.id);
  const [spend, points] = await read(ctx, (tx) =>
    Promise.all([
      tx.sale.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, status: "completed" }, _sum: { total: true }, _count: true }),
      tx.loyaltyEntry.groupBy({ by: ["customerId"], where: { customerId: { in: ids } }, _sum: { points: true } }),
    ]),
  );
  const spendBy = new Map(spend.map((s) => [s.customerId, s]));
  const pointsBy = new Map(points.map((p) => [p.customerId, p._sum.points ?? 0]));
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("customers")}
        description={`${count} customers`}
        actions={can(ctx.member, "customers.edit") ? <CustomerForm customer={null} customFields={ctx.settings.customFields.customer} /> : null}
      />
      <Card className="p-3">
        <form className="flex gap-2" role="search">
          <Input name="q" defaultValue={sp.q} placeholder="Name, phone, email or group" aria-label="Search customers" className="max-w-sm" />
          <Button type="submit">Search</Button>
        </form>
      </Card>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Phone</Th>
              <Th>Email</Th>
              <Th>Group</Th>
              <Th className="text-right">Visits</Th>
              <Th className="text-right">Spend</Th>
              {ctx.tenant.modules.includes("loyalty") ? <Th className="text-right">Points</Th> : null}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <Td>
                  <Link className="font-medium text-primary-ink underline" href={`/customers/${c.id}`}>
                    {c.name}
                  </Link>{" "}
                  {c.marketingConsent ? <Badge tone="primary">Marketing ✓</Badge> : null}
                </Td>
                <Td>{c.phone}</Td>
                <Td>{c.email}</Td>
                <Td>{c.group}</Td>
                <Td className="tabular text-right">{spendBy.get(c.id)?._count ?? 0}</Td>
                <Td className="tabular text-right">{m(spendBy.get(c.id)?._sum.total ?? 0)}</Td>
                {ctx.tenant.modules.includes("loyalty") ? <Td className="tabular text-right">{pointsBy.get(c.id) ?? 0}</Td> : null}
              </tr>
            ))}
          </tbody>
        </Table>
        {!customers.length ? <EmptyState title="No customers found">Customers can also be added at the register.</EmptyState> : null}
        {count > 50 ? (
          <div className="flex justify-between p-3 text-sm">
            {page > 1 ? (
              <Link className="text-primary-ink underline" href={`/customers?page=${page - 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}>
                Previous
              </Link>
            ) : (
              <span />
            )}
            {page * 50 < count ? (
              <Link className="text-primary-ink underline" href={`/customers?page=${page + 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}>
                Next
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
