import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@unipos/ui";
import Link from "next/link";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateTime } from "@/lib/format";
import { NewTransfer } from "./new-transfer";

export const metadata = { title: "Transfers" };

const tone = { draft: "neutral", in_transit: "warning", received: "success", cancelled: "danger" } as const;

export default async function TransfersPage() {
  const ctx = await requireContext("inventory.transfer", "multilocation");
  const [list, allLocations] = await read(ctx, (tx) =>
    Promise.all([
      tx.transfer.findMany({ where: { OR: [{ fromLocationId: ctx.locationId }, { toLocationId: ctx.locationId }] }, orderBy: { createdAt: "desc" }, take: 50, include: { _count: { select: { lines: true } } } }),
      tx.location.findMany({ where: { deletedAt: null, active: true } }),
    ]),
  );
  const names = new Map(allLocations.map((l) => [l.id, l.name]));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stock transfers"
        description="Move stock between locations. Stock leaves on send (in transit) and arrives on receive."
        actions={<NewTransfer currency={ctx.currency} locations={allLocations.filter((l) => l.id !== ctx.locationId).map((l) => ({ id: l.id, name: l.name }))} />}
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Number</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Items</Th>
              <Th>Status</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <Td>
                  <Link className="text-primary underline" href={`/inventory/transfers/${t.id}`}>
                    {t.number}
                  </Link>
                </Td>
                <Td>{names.get(t.fromLocationId)}</Td>
                <Td>{names.get(t.toLocationId)}</Td>
                <Td>{t._count.lines}</Td>
                <Td>
                  <Badge tone={tone[t.status as keyof typeof tone] ?? "neutral"}>{t.status.replace("_", " ")}</Badge>
                </Td>
                <Td>{dateTime(t.createdAt, ctx.timezone, ctx.locale)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!list.length ? <EmptyState title="No transfers yet">{allLocations.length < 2 ? "Add a second location in Settings → Locations first." : null}</EmptyState> : null}
      </Card>
    </div>
  );
}
