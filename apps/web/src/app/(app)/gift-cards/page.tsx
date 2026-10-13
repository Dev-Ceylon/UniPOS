import { Badge, Card, EmptyState, Input, PageHeader, Table, Td, Th } from "@unipos/ui";
import { getTranslations } from "next-intl/server";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { dateOnly, money } from "@/lib/format";
import { GiftCardToggle, IssueGiftCard } from "./forms";

export const metadata = { title: "Gift cards" };

export default async function GiftCardsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireContext("giftcards.manage", "giftcards");
  const t = await getTranslations("nav");
  const sp = await searchParams;
  const cards = await read(ctx, (tx) =>
    tx.giftCard.findMany({
      where: sp.q ? { code: { contains: sp.q.toUpperCase() } } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { entries: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  );
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  const outstanding = cards.filter((c) => c.active).reduce((a, c) => a + c.balance, 0);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("giftCards")}
        description={`Outstanding balance ${m(outstanding)} (a liability until redeemed)`}
        actions={<IssueGiftCard currency={ctx.currency} />}
      />
      <form className="flex gap-2" role="search">
        <Input name="q" defaultValue={sp.q} placeholder="Card code" aria-label="Search gift cards" className="max-w-xs" />
      </form>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th className="text-right">Issued</Th>
              <Th className="text-right">Balance</Th>
              <Th>Expires</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id}>
                <Td className="font-mono">{c.code}</Td>
                <Td className="tabular text-right">{m(c.initialValue)}</Td>
                <Td className="tabular text-right font-medium">{m(c.balance)}</Td>
                <Td>{c.expiresAt ? dateOnly(c.expiresAt, ctx.timezone, ctx.locale) : "—"}</Td>
                <Td>
                  <Badge tone={c.active ? "success" : "neutral"}>{c.active ? "Active" : "Inactive"}</Badge>
                </Td>
                <Td className="text-right">
                  <GiftCardToggle id={c.id} active={c.active} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!cards.length ? <EmptyState title="No gift cards yet">Issue a card, then customers can pay with it at the register.</EmptyState> : null}
      </Card>
    </div>
  );
}
