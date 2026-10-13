import { Badge, Card, CardHeader, CardTitle, EmptyState, PageHeader, Table, Td, Th } from "@unipos/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateOnly, money } from "@/lib/format";
import { NewPo, SupplierButton } from "./forms";

export const metadata = { title: "Purchasing" };

const tone = { draft: "neutral", ordered: "primary", partial: "warning", received: "success", cancelled: "danger" } as const;

export default async function PurchasingPage() {
  const ctx = await requireContext("purchasing.manage", "purchasing");
  const t = await getTranslations("nav");
  const [orders, suppliers] = await read(ctx, (tx) =>
    Promise.all([
      tx.purchaseOrder.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { supplier: true } }),
      tx.supplier.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, include: { _count: { select: { orders: true } } } }),
    ]),
  );
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  const locs = new Map(ctx.locations.map((l) => [l.id, l.name]));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("purchasing")} actions={<NewPo currency={ctx.currency} suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Purchase orders</CardTitle>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>Number</Th>
                <Th>Supplier</Th>
                <Th>Deliver to</Th>
                <Th>Expected</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <Link className="text-primary underline" href={`/purchasing/orders/${o.id}`}>
                      {o.number}
                    </Link>
                  </Td>
                  <Td>{o.supplier.name}</Td>
                  <Td>{locs.get(o.locationId) ?? "—"}</Td>
                  <Td>{o.expectedAt ? dateOnly(o.expectedAt, ctx.timezone, ctx.locale) : "—"}</Td>
                  <Td>
                    <Badge tone={tone[o.status as keyof typeof tone] ?? "neutral"}>{o.status}</Badge>
                  </Td>
                  <Td className="tabular text-right">{m(o.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!orders.length ? <EmptyState title="No purchase orders yet" /> : null}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Suppliers</CardTitle>
            <SupplierButton supplier={null} />
          </CardHeader>
          <ul className="divide-y divide-border">
            {suppliers.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                <span>
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-xs text-muted">{[s.contact, s.phone, s.email].filter(Boolean).join(" · ")}</span>
                </span>
                <SupplierButton supplier={{ id: s.id, name: s.name, contact: s.contact ?? "", phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "", notes: s.notes ?? "" }} />
              </li>
            ))}
            {!suppliers.length ? <li className="px-4 py-6 text-sm text-muted">Add your first supplier.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
