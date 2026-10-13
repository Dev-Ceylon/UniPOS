import { formatMoney, isValidEan13 } from "@unipos/core";
import { PageHeader } from "@unipos/ui";
import { Barcode } from "@/components/barcode";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { PrintLabels } from "./print";

export const metadata = { title: "Print labels" };

export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ q?: string; copies?: string }> }) {
  const ctx = await requireContext("products.view");
  const sp = await searchParams;
  const copies = Math.min(20, Math.max(1, Number(sp.copies) || 1));
  const variants = await read(ctx, (tx) =>
    tx.variant.findMany({
      where: {
        deletedAt: null,
        product: { deletedAt: null, ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" } } : {}) },
        OR: [{ barcode: { not: null } }, { sku: { not: null } }],
      },
      include: { product: true },
      orderBy: { product: { name: "asc" } },
      take: 200,
    }),
  );
  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Barcode labels"
          description={`${variants.length} labels × ${copies}. Print on A4 label sheets (3 × 8) or a label printer.`}
          actions={<PrintLabels />}
        />
        <form className="mb-4 flex gap-2 text-sm">
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Filter by name"
            className="h-9 rounded border border-border bg-surface px-2"
            aria-label="Filter by name"
          />
          <input
            name="copies"
            type="number"
            min={1}
            max={20}
            defaultValue={copies}
            className="h-9 w-20 rounded border border-border bg-surface px-2"
            aria-label="Copies"
          />
          <button className="rounded bg-primary px-3 text-primary-fg">Apply</button>
        </form>
      </div>
      <div className="print-area label-sheet grid grid-cols-3 gap-2 bg-white text-black">
        {variants.flatMap((v) =>
          Array.from({ length: copies }, (_, i) => (
            <div
              key={`${v.id}-${i}`}
              className="label flex flex-col items-center justify-center rounded border border-dashed border-gray-300 p-2 text-center"
              style={{ height: "33mm" }}
            >
              <p className="line-clamp-1 text-xs font-medium">
                {v.product.name}
                {v.name ? ` — ${v.name}` : ""}
              </p>
              <p className="text-sm font-bold">{formatMoney(v.price, ctx.currency)}</p>
              <Barcode value={v.barcode ?? v.sku!} format={v.barcode && isValidEan13(v.barcode) ? "EAN13" : "CODE128"} height={36} width={1.3} />
            </div>
          )),
        )}
      </div>
    </div>
  );
}
