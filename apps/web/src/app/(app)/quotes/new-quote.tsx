"use client";
import { formatMoney, parseMoney, toDecimalString } from "@unipos/core";
import { Button, Dialog, Field, Input, Textarea } from "@unipos/ui";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAction } from "@/components/use-action";
import { VariantPicker } from "@/components/variant-picker";
import { searchCustomers } from "@/lib/search-actions";
import { createQuote } from "./actions";

export function NewQuote({ currency, hasCustomers }: { currency: string; hasCustomers: boolean }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<{ variantId: string; name: string; qty: number; price: string }[]>([]);
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [cq, setCq] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string }[]>([]);
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const { run, pending } = useAction();
  const router = useRouter();
  useEffect(() => {
    if (!cq.trim() || !hasCustomers) return setHits([]);
    const id = setTimeout(async () => {
      const r = await searchCustomers(cq);
      if (r.ok) setHits(r.data);
    }, 200);
    return () => clearTimeout(id);
  }, [cq, hasCustomers]);
  const submit = () => {
    try {
      const payload = lines.map((l) => ({ variantId: l.variantId, qty: l.qty, unitPrice: parseMoney(l.price, currency) }));
      run(() => createQuote({ customerId: customer?.id ?? null, validUntil, note, lines: payload }), { onOk: (id) => router.push(`/quotes/${id}`) });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>New quotation</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New quotation"
        size="lg"
        footer={
          <Button loading={pending} disabled={!lines.length} onClick={submit}>
            Create
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {hasCustomers ? (
            <Field label="Customer" htmlFor="q-cust">
              {customer ? (
                <div className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
                  {customer.name}
                  <Button size="sm" variant="ghost" onClick={() => setCustomer(null)}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input id="q-cust" value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Search customers" />
                  {hits.length ? (
                    <ul className="absolute z-30 mt-1 w-full rounded border border-border bg-surface shadow">
                      {hits.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                            onClick={() => {
                              setCustomer(h);
                              setCq("");
                              setHits([]);
                            }}
                          >
                            {h.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </Field>
          ) : null}
          <VariantPicker
            currency={currency}
            onPick={(v) => setLines((ls) => [...ls, { variantId: v.id, name: v.name, qty: 1, price: toDecimalString(v.price, currency) }])}
          />
          <ul className="flex flex-col gap-2">
            {lines.map((l, i) => (
              <li key={i} className="grid grid-cols-[1fr_5rem_7rem_auto] items-center gap-2 text-sm">
                <span>{l.name}</span>
                <Input
                  aria-label={`Quantity ${l.name}`}
                  type="number"
                  min={1}
                  value={l.qty}
                  onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))}
                />
                <Input
                  aria-label={`Price ${l.name}`}
                  inputMode="decimal"
                  value={l.price}
                  onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                />
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
          {lines.length ? (
            <p className="text-right text-sm text-muted">
              Subtotal{" "}
              {formatMoney(
                lines.reduce((a, l) => {
                  try {
                    return a + parseMoney(l.price, currency) * l.qty;
                  } catch {
                    return a;
                  }
                }, 0),
                currency,
              )}{" "}
              (taxes added on save)
            </p>
          ) : null}
          <Field label="Valid until" htmlFor="q-valid">
            <Input id="q-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
          <Field label="Note" htmlFor="q-note">
            <Textarea id="q-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
