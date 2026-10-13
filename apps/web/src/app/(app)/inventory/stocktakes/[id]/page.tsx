import { PageHeader } from "@unipos/ui";
import { notFound } from "next/navigation";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { CountSheet } from "./count-sheet";

export default async function StocktakePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("inventory.stocktake", "inventory");
  const { id } = await params;
  const st = await read(ctx, async (tx) => {
    const s = await tx.stocktake.findUnique({ where: { id }, include: { lines: true } });
    if (!s) return null;
    const variants = await tx.variant.findMany({ where: { id: { in: s.lines.map((l) => l.variantId) } }, include: { product: true } });
    return { s, variants };
  });
  if (!st) notFound();
  const byId = new Map(st.variants.map((v) => [v.id, v]));
  return (
    <div>
      <PageHeader title="Stocktake" description={`${st.s.status} · ${st.s.lines.length} items${st.s.note ? ` · ${st.s.note}` : ""}`} />
      <CountSheet
        id={st.s.id}
        open={st.s.status === "open"}
        lines={st.s.lines
          .map((l) => {
            const v = byId.get(l.variantId);
            return { variantId: l.variantId, name: v ? (v.name ? `${v.product.name} — ${v.name}` : v.product.name) : "?", sku: v?.sku ?? null, barcode: v?.barcode ?? null, expected: l.expected, counted: l.counted };
          })
          .sort((a, b) => a.name.localeCompare(b.name))}
      />
    </div>
  );
}
