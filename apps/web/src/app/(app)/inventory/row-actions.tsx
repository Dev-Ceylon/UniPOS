"use client";
import { Button, Dialog, Field, Input, Select } from "@unipos/ui";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { adjustAction, reorderAction } from "./actions";

export function AdjustButton({ variantId, name, onHand }: { variantId: string; name: string; onHand: number }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Adjust
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Adjust ${name}`} description={`On hand: ${onHand}`} size="sm">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(
              () =>
                adjustAction({
                  variantId,
                  mode: fd.get("mode") as "delta" | "set",
                  qty: Number(fd.get("qty")),
                  reason: String(fd.get("reason")),
                  note: String(fd.get("note") || "") || undefined,
                }),
              { success: "Stock adjusted", onOk: () => setOpen(false) },
            );
          }}
        >
          <Field label="Type" htmlFor="mode">
            <Select id="mode" name="mode" defaultValue="delta">
              <option value="delta">Add or remove (+/−)</option>
              <option value="set">Set counted quantity</option>
            </Select>
          </Field>
          <Field label="Quantity" htmlFor="qty">
            <Input id="qty" name="qty" type="number" required step={1} />
          </Field>
          <Field label="Reason" htmlFor="reason">
            <Select id="reason" name="reason" defaultValue="adjust">
              <option value="adjust">Correction</option>
              <option value="damage">Damaged / expired</option>
              <option value="receive">Received (no PO)</option>
              <option value="return">Customer return</option>
            </Select>
          </Field>
          <Field label="Note" htmlFor="note">
            <Input id="note" name="note" maxLength={200} />
          </Field>
          <Button type="submit" loading={pending}>
            Save adjustment
          </Button>
        </form>
      </Dialog>
    </>
  );
}

export function ReorderInput({ variantId, value }: { variantId: string; value: number | null }) {
  const { run } = useAction();
  return (
    <input
      type="number"
      min={0}
      defaultValue={value ?? ""}
      aria-label="Reorder point"
      className="h-8 w-20 rounded border border-border bg-surface px-2 text-right text-sm"
      onBlur={(e) => {
        const v = e.target.value === "" ? null : Number(e.target.value);
        if (v !== value) run(() => reorderAction(variantId, v), { refresh: false });
      }}
    />
  );
}
