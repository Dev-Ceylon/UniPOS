import { Card, EmptyState, Input, PageHeader, Table, Td, Th } from "@unipos/ui";
import Link from "next/link";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const ctx = await requireContext("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.q
    ? {
        OR: [
          { action: { contains: sp.q } },
          { entity: { contains: sp.q, mode: "insensitive" as const } },
          { actorName: { contains: sp.q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const logs = await read(ctx, (tx) => tx.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, skip: (page - 1) * 100 }));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Audit log" description="Append-only record of refunds, voids, price changes, settings and staff changes." />
      <form className="flex gap-2" role="search">
        <Input name="q" defaultValue={sp.q} placeholder="Action, entity or person (e.g. sale.refund)" aria-label="Filter audit log" className="max-w-md" />
      </form>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap">{dateTime(l.createdAt, ctx.timezone, ctx.locale)}</Td>
                <Td>{l.actorName ?? "—"}</Td>
                <Td>
                  <code className="text-xs">{l.action}</code>
                </Td>
                <Td>
                  {l.entity === "Sale" && l.entityId ? (
                    <Link className="text-primary-ink underline" href={`/sales/${l.entityId}`}>
                      Sale
                    </Link>
                  ) : (
                    l.entity
                  )}
                </Td>
                <Td className="max-w-md truncate font-mono text-xs text-muted" title={JSON.stringify({ before: l.before, after: l.after })}>
                  {l.after ? JSON.stringify(l.after) : ""}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!logs.length ? <EmptyState title="No entries" /> : null}
        {logs.length === 100 ? (
          <div className="p-3 text-right text-sm">
            <Link className="text-primary-ink underline" href={`/settings/audit?page=${page + 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}>
              Older
            </Link>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
