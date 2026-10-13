import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@unipos/ui";
import Link from "next/link";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateTime } from "@/lib/format";
import { StartStocktake } from "./start";

export const metadata = { title: "Stocktakes" };

export default async function StocktakesPage() {
  const ctx = await requireContext("inventory.stocktake", "inventory");
  const [list, categories] = await read(ctx, (tx) =>
    Promise.all([
      tx.stocktake.findMany({
        where: { locationId: ctx.locationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { _count: { select: { lines: true } } },
      }),
      tx.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]),
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stocktakes"
        description="Count stock and post the differences to the ledger. Sales during the count are kept."
        actions={<StartStocktake categories={categories} />}
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Started</Th>
              <Th>Status</Th>
              <Th>Items</Th>
              <Th>Note</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <Td>
                  <Link className="text-primary-ink underline" href={`/inventory/stocktakes/${s.id}`}>
                    {dateTime(s.createdAt, ctx.timezone, ctx.locale)}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={s.status === "open" ? "warning" : s.status === "completed" ? "success" : "neutral"}>{s.status}</Badge>
                </Td>
                <Td>{s._count.lines}</Td>
                <Td>{s.note}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!list.length ? <EmptyState title="No stocktakes yet" /> : null}
      </Card>
    </div>
  );
}
