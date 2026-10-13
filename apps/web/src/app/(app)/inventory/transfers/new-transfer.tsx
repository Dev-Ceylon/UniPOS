"use client";
import { Button, Dialog, Field, Input, Select } from "@unipos/ui";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { VariantPicker } from "@/components/variant-picker";
import { createTransferAction } from "../actions";

export function NewTransfer({ locations, currency }: { locations: { id: string; name: string }[]; currency: string }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<{ variantId: string; name: string; qty: number; onHand: number }[]>([]);
  const [to, setTo] = useState(locations[0]?.id ?? "");
  const [note, setNote] = useState("");
  const { run, pending } = useAction();
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!locations.length}>
        New transfer
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New transfer"
        size="lg"
        footer={
          <Button
            loading={pending}
            disabled={!lines.length || !to}
            onClick={() => run(() => createTransferAction(to, lines.map((l) => ({ variantId: l.variantId, qty: l.qty })), note), { onOk: (id) => router.push(`/inventory/transfers/${id}`) })}
          >
            Create draft
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="To location" htmlFor="to">
            <Select id="to" value={to} onChange={(e) => setTo(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <VariantPicker
            currency={currency}
            onPick={(v) =>
              setLines((ls) => (ls.some((l) => l.variantId === v.id) ? ls.map((l) => (l.variantId === v.id ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { variantId: v.id, name: v.name, qty: 1, onHand: v.onHand }]))
            }
          />
          <ul className="flex flex-col gap-2">
            {lines.map((l) => (
              <li key={l.variantId} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {l.name} <span className="text-muted">({l.onHand} here)</span>
                </span>
                <span className="flex items-center gap-1">
                  <Input aria-label={`Quantity ${l.name}`} type="number" min={1} className="w-20" value={l.qty} onChange={(e) => setLines((ls) => ls.map((x) => (x.variantId === l.variantId ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))} />
                  <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setLines((ls) => ls.filter((x) => x.variantId !== l.variantId))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <Field label="Note" htmlFor="tr-note">
            <Input id="tr-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
