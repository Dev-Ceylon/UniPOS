import { Badge, Card, PageHeader, Table, Td, Th } from "@unipos/ui";
import { notFound } from "next/navigation";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateTime } from "@/lib/format";
import { TransferActions } from "./transfer-actions";

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("inventory.transfer", "multilocation");
  const { id } = await params;
  const data = await read(ctx, async (tx) => {
    const t = await tx.transfer.findUnique({ where: { id }, include: { lines: true } });
    const locs = await tx.location.findMany();
    return t ? { t, locs } : null;
  });
  if (!data) notFound();
  const { t } = data;
  const names = new Map(data.locs.map((l) => [l.id, l.name]));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Transfer ${t.number}`}
        description={`${names.get(t.fromLocationId)} → ${names.get(t.toLocationId)} · created ${dateTime(t.createdAt, ctx.timezone, ctx.locale)}${t.note ? ` · ${t.note}` : ""}`}
        actions={
          <>
            <Badge tone={t.status === "received" ? "success" : t.status === "in_transit" ? "warning" : "neutral"}>{t.status.replace("_", " ")}</Badge>
            <TransferActions
              id={t.id}
              status={t.status}
              atDestination={ctx.locationId === t.toLocationId}
              lines={t.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty }))}
            />
          </>
        }
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th className="text-right">Sent</Th>
              <Th className="text-right">Received</Th>
            </tr>
          </thead>
          <tbody>
            {t.lines.map((l) => (
              <tr key={l.id}>
                <Td>{l.name}</Td>
                <Td className="tabular text-right">{l.qty}</Td>
                <Td className="tabular text-right">{t.status === "received" ? l.qtyReceived : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
