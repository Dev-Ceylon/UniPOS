"use client";
import { Button, Dialog, Input } from "@unipos/ui";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { transferStep } from "../../actions";

export function TransferActions({ id, status, atDestination, lines }: { id: string; status: string; atDestination: boolean; lines: { id: string; name: string; qty: number }[] }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [rec, setRec] = useState<Record<string, number>>(Object.fromEntries(lines.map((l) => [l.id, l.qty])));
  return (
    <>
      {status === "draft" ? (
        <Button loading={pending} onClick={() => run(() => transferStep(id, "send"), { success: "Sent — stock is in transit" })}>
          Send
        </Button>
      ) : null}
      {status === "in_transit" ? (
        <Button loading={pending} onClick={() => setOpen(true)} title={atDestination ? undefined : "Usually done at the destination"}>
          Receive
        </Button>
      ) : null}
      {status === "draft" || status === "in_transit" ? (
        <Button variant="ghost" onClick={() => confirm("Cancel this transfer?") && run(() => transferStep(id, "cancel"), { success: "Cancelled" })}>
          Cancel
        </Button>
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Receive transfer"
        footer={
          <Button loading={pending} onClick={() => run(() => transferStep(id, "receive", rec), { success: "Received", onOk: () => setOpen(false) })}>
            Confirm receipt
          </Button>
        }
      >
        <ul className="flex flex-col gap-2">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {l.name} <span className="text-muted">(sent {l.qty})</span>
              </span>
              <Input aria-label={`Received ${l.name}`} type="number" min={0} max={l.qty} className="w-20" value={rec[l.id]} onChange={(e) => setRec((r) => ({ ...r, [l.id]: Math.min(l.qty, Math.max(0, Number(e.target.value) || 0)) }))} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Anything not received goes back to the source location.</p>
      </Dialog>
    </>
  );
}
