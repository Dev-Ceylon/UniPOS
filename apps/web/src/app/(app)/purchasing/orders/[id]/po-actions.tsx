"use client";
import { Button, Dialog, Input } from "@unipos/ui";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { poStep, receivePoAction } from "../../actions";

export function PoActions({ id, status, lines }: { id: string; status: string; lines: { id: string; name: string; remaining: number }[] }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [rec, setRec] = useState<Record<string, number>>({});
  return (
    <>
      {status === "draft" ? (
        <Button loading={pending} onClick={() => run(() => poStep(id, "order"), { success: "Marked as ordered" })}>
          Mark ordered
        </Button>
      ) : null}
      {status === "ordered" || status === "partial" ? (
        <Button
          onClick={() => {
            setRec(Object.fromEntries(lines.map((l) => [l.id, l.remaining])));
            setOpen(true);
          }}
        >
          Receive stock
        </Button>
      ) : null}
      {status === "draft" || status === "ordered" ? (
        <Button variant="ghost" onClick={() => confirm("Cancel this order?") && run(() => poStep(id, "cancel"), { success: "Cancelled" })}>
          Cancel
        </Button>
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Receive into stock"
        footer={
          <Button loading={pending} onClick={() => run(() => receivePoAction(id, rec), { success: "Stock received", onOk: () => setOpen(false) })}>
            Receive
          </Button>
        }
      >
        <ul className="flex flex-col gap-2">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {l.name} <span className="text-muted">({l.remaining} outstanding)</span>
              </span>
              <Input
                aria-label={`Receive ${l.name}`}
                type="number"
                min={0}
                max={l.remaining}
                className="w-20"
                value={rec[l.id] ?? 0}
                onChange={(e) => setRec((r) => ({ ...r, [l.id]: Math.min(l.remaining, Math.max(0, Number(e.target.value) || 0)) }))}
              />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Receiving updates each product&apos;s cost to the PO unit cost.</p>
      </Dialog>
    </>
  );
}
