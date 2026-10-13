"use client";
import { formatMoney } from "@unipos/core";
import { Input } from "@unipos/ui";
import { useEffect, useState } from "react";
import { searchVariants, type VariantHit } from "@/lib/search-actions";

/** Type-ahead product search; Enter on an exact barcode/SKU picks it immediately (scanner friendly). */
export function VariantPicker({
  onPick,
  currency,
  placeholder = "Search or scan a product",
}: {
  onPick: (v: VariantHit) => void;
  currency: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<VariantHit[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const id = setTimeout(async () => {
      const res = await searchVariants(q);
      if (res.ok) {
        setHits(res.data);
        setOpen(true);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [q]);
  const pick = (v: VariantHit) => {
    onPick(v);
    setQ("");
    setHits([]);
    setOpen(false);
  };
  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={open && hits.length > 0}
        onKeyDown={async (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const res = await searchVariants(q);
            if (res.ok) {
              const exact =
                res.data.find((v) => v.barcode === q.trim() || v.sku?.toLowerCase() === q.trim().toLowerCase()) ??
                (res.data.length === 1 ? res.data[0] : undefined);
              if (exact) pick(exact);
              else setHits(res.data);
            }
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && hits.length ? (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {hits.map((h) => (
            <li key={h.id} role="option" aria-selected={false}>
              <button type="button" className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2" onClick={() => pick(h)}>
                <span>
                  {h.name} <span className="text-muted">{h.sku}</span>
                </span>
                <span className="tabular text-muted">
                  {formatMoney(h.price, currency)} · {h.onHand} on hand
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
