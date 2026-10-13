"use client";
import { toDecimalString } from "@unipos/core";
import { Button, Dialog, Field, Input, Select, Textarea } from "@unipos/ui";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { VariantPicker } from "@/components/variant-picker";
import { createPoAction, saveSupplier } from "./actions";

type Supplier = { id: string; name: string; contact: string; phone: string; email: string; address: string; notes: string };

export function SupplierButton({ supplier }: { supplier: Supplier | null }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  return (
    <>
      <Button size="sm" variant={supplier ? "ghost" : "outline"} onClick={() => setOpen(true)}>
        {supplier ? "Edit" : "Add"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={supplier ? supplier.name : "New supplier"}>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = Object.fromEntries(new FormData(e.currentTarget));
            run(() => saveSupplier(supplier?.id ?? null, fd), { success: "Supplier saved", onOk: () => setOpen(false) });
          }}
        >
          <Field label="Name" htmlFor="s-name" className="sm:col-span-2">
            <Input id="s-name" name="name" required defaultValue={supplier?.name} />
          </Field>
          <Field label="Contact person" htmlFor="s-contact">
            <Input id="s-contact" name="contact" defaultValue={supplier?.contact} />
          </Field>
          <Field label="Phone" htmlFor="s-phone">
            <Input id="s-phone" name="phone" type="tel" defaultValue={supplier?.phone} />
          </Field>
          <Field label="Email" htmlFor="s-email" className="sm:col-span-2">
            <Input id="s-email" name="email" type="email" defaultValue={supplier?.email} />
          </Field>
          <Field label="Address" htmlFor="s-address" className="sm:col-span-2">
            <Textarea id="s-address" name="address" defaultValue={supplier?.address} />
          </Field>
          <Field label="Notes" htmlFor="s-notes" className="sm:col-span-2">
            <Textarea id="s-notes" name="notes" defaultValue={supplier?.notes} />
          </Field>
          <Button type="submit" loading={pending} className="sm:col-span-2">
            Save
          </Button>
        </form>
      </Dialog>
    </>
  );
}

export function NewPo({ suppliers, currency }: { suppliers: { id: string; name: string }[]; currency: string }) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [expectedAt, setExpectedAt] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<{ variantId: string; name: string; qty: number; unitCost: string }[]>([]);
  const { run, pending } = useAction();
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!suppliers.length} title={suppliers.length ? undefined : "Add a supplier first"}>
        New purchase order
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New purchase order"
        size="lg"
        footer={
          <Button loading={pending} disabled={!lines.length} onClick={() => run(() => createPoAction({ supplierId, expectedAt, note, lines }), { onOk: (id) => router.push(`/purchasing/orders/${id}`) })}>
            Create draft
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Supplier" htmlFor="po-supplier">
              <Select id="po-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Expected delivery" htmlFor="po-expected">
              <Input id="po-expected" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
            </Field>
          </div>
          <VariantPicker
            currency={currency}
            onPick={(v) => setLines((ls) => (ls.some((l) => l.variantId === v.id) ? ls : [...ls, { variantId: v.id, name: v.name, qty: 1, unitCost: toDecimalString(v.cost, currency) }]))}
          />
          <ul className="flex flex-col gap-2">
            {lines.map((l) => (
              <li key={l.variantId} className="grid grid-cols-[1fr_5rem_7rem_auto] items-center gap-2 text-sm">
                <span>{l.name}</span>
                <Input aria-label={`Quantity ${l.name}`} type="number" min={1} value={l.qty} onChange={(e) => setLines((ls) => ls.map((x) => (x.variantId === l.variantId ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))} />
                <Input aria-label={`Unit cost ${l.name}`} inputMode="decimal" value={l.unitCost} onChange={(e) => setLines((ls) => ls.map((x) => (x.variantId === l.variantId ? { ...x, unitCost: e.target.value } : x)))} />
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setLines((ls) => ls.filter((x) => x.variantId !== l.variantId))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
          <Field label="Note" htmlFor="po-note">
            <Input id="po-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
