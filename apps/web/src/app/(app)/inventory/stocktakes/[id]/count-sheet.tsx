"use client";
import { Badge, Button, Card, Input, Table, Td, Th } from "@unipos/ui";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAction } from "@/components/use-action";
import { cancelStocktakeAction, completeStocktakeAction, saveCountsAction } from "../../actions";

type Line = { variantId: string; name: string; sku: string | null; barcode: string | null; expected: number; counted: number | null };

export function CountSheet({ id, open, lines }: { id: string; open: boolean; lines: Line[] }) {
  const [counts, setCounts] = useState<Record<string, number | null>>(Object.fromEntries(lines.map((l) => [l.variantId, l.counted])));
  const [scan, setScan] = useState("");
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const { run, pending } = useAction();
  const router = useRouter();
  const payload = () => Object.entries(counts).map(([variantId, counted]) => ({ variantId, counted }));
  const countedN = Object.values(counts).filter((c) => c !== null).length;
  const variances = lines.filter((l) => counts[l.variantId] != null && counts[l.variantId] !== l.expected).length;
  return (
    <div className="flex flex-col gap-4">
      {open ? (
        <Card className="flex flex-wrap items-center gap-2 p-3">
          <Input
            className="max-w-xs"
            placeholder="Scan barcode to count +1"
            aria-label="Scan barcode"
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const l = lines.find((x) => x.barcode === scan.trim() || x.sku?.toLowerCase() === scan.trim().toLowerCase());
              if (!l) toast.error("Not in this stocktake");
              else {
                setCounts((c) => ({ ...c, [l.variantId]: (c[l.variantId] ?? 0) + 1 }));
                refs.current[l.variantId]?.scrollIntoView({ block: "center" });
              }
              setScan("");
            }}
          />
          <span className="text-sm text-muted">
            {countedN}/{lines.length} counted · {variances} variances
          </span>
          <span className="ml-auto flex gap-2">
            <Button variant="outline" loading={pending} onClick={() => run(() => saveCountsAction(id, payload()), { success: "Counts saved" })}>
              Save progress
            </Button>
            <Button
              loading={pending}
              onClick={() => confirm("Post variances to stock?") && run(() => completeStocktakeAction(id, payload()), { success: "Stocktake completed", onOk: () => router.push("/inventory/stocktakes") })}
            >
              Complete
            </Button>
            <Button variant="ghost" onClick={() => confirm("Cancel this stocktake?") && run(() => cancelStocktakeAction(id), { onOk: () => router.push("/inventory/stocktakes") })}>
              Cancel
            </Button>
          </span>
        </Card>
      ) : null}
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th className="text-right">Expected</Th>
              <Th className="text-right">Counted</Th>
              <Th className="text-right">Variance</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const c = counts[l.variantId];
              const v = c == null ? null : c - l.expected;
              return (
                <tr key={l.variantId}>
                  <Td>
                    {l.name} <span className="text-xs text-muted">{l.sku}</span>
                  </Td>
                  <Td className="tabular text-right">{l.expected}</Td>
                  <Td className="text-right">
                    <input
                      ref={(el) => {
                        refs.current[l.variantId] = el;
                      }}
                      disabled={!open}
                      type="number"
                      min={0}
                      aria-label={`Counted ${l.name}`}
                      className="h-8 w-24 rounded border border-border bg-surface px-2 text-right"
                      value={c ?? ""}
                      onChange={(e) => setCounts((x) => ({ ...x, [l.variantId]: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) }))}
                    />
                  </Td>
                  <Td className="text-right">{v === null ? "—" : v === 0 ? <Badge tone="success">0</Badge> : <Badge tone={v < 0 ? "danger" : "warning"}>{v > 0 ? `+${v}` : v}</Badge>}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
