"use client";
import { formatMoney, parseMoney, toDecimalString, type Discount } from "@unipos/core";
import { Alert, Button, Dialog, Field, Input, Select } from "@unipos/ui";
import { useEffect, useRef, useState } from "react";
import type { CachedCustomer, CachedModifierGroup, CachedProduct } from "@/offline/db";

/** Choose modifiers for a product (restaurant options, extras). */
export function ModifierDialog({
  product,
  groups,
  currency,
  onClose,
  onAdd,
}: {
  product: CachedProduct | null;
  groups: CachedModifierGroup[];
  currency: string;
  onClose: () => void;
  onAdd: (mods: { name: string; priceDelta: number }[], note: string, course: number) => void;
}) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const [course, setCourse] = useState(1);
  useEffect(() => {
    setPicked({});
    setNote("");
    setCourse(1);
  }, [product?.id]);
  const relevant = groups.filter((g) => product?.modifierGroupIds.includes(g.id));
  const errors = relevant.filter((g) => (picked[g.id]?.length ?? 0) < g.minSelect);
  return (
    <Dialog
      open={!!product}
      onClose={onClose}
      title={product?.name ?? ""}
      footer={
        <Button
          disabled={errors.length > 0}
          onClick={() => {
            const mods = relevant.flatMap((g) => (picked[g.id] ?? []).map((n) => g.modifiers.find((m) => m.name === n)!).filter(Boolean));
            onAdd(mods, note, course);
          }}
        >
          Add to order
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {relevant.map((g) => (
          <fieldset key={g.id}>
            <legend className="mb-2 text-sm font-medium">
              {g.name} <span className="text-muted">{g.maxSelect === 1 ? "(choose one)" : `(up to ${g.maxSelect})`}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {g.modifiers.map((m) => {
                const on = picked[g.id]?.includes(m.name) ?? false;
                return (
                  <Button
                    key={m.name}
                    variant={on ? "primary" : "outline"}
                    aria-pressed={on}
                    onClick={() =>
                      setPicked((p) => {
                        const cur = p[g.id] ?? [];
                        if (on) return { ...p, [g.id]: cur.filter((x) => x !== m.name) };
                        if (g.maxSelect === 1) return { ...p, [g.id]: [m.name] };
                        if (cur.length >= g.maxSelect) return p;
                        return { ...p, [g.id]: [...cur, m.name] };
                      })
                    }
                  >
                    {m.name}
                    {m.priceDelta ? <span className="text-xs opacity-80">+{formatMoney(m.priceDelta, currency)}</span> : null}
                  </Button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Kitchen note" htmlFor="mod-note" className="col-span-2">
            <Input id="mod-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Course" htmlFor="mod-course">
            <Select id="mod-course" value={course} onChange={(e) => setCourse(Number(e.target.value))}>
              <option value={1}>1 · Starter</option>
              <option value={2}>2 · Main</option>
              <option value={3}>3 · Dessert</option>
            </Select>
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

/** Percent or fixed discount, used for a line or the whole order. */
export function DiscountDialog({
  open,
  title,
  currency,
  current,
  onClose,
  onApply,
}: {
  open: boolean;
  title: string;
  currency: string;
  current: Discount | null;
  onClose: () => void;
  onApply: (d: Discount | null) => void;
}) {
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setKind(current?.type ?? "percent");
    setValue(current ? (current.type === "percent" ? String(current.valueBp / 100) : toDecimalString(current.value, currency)) : "");
    setError(null);
  }, [open, current, currency]);
  const apply = () => {
    try {
      if (!value) return onApply(null);
      if (kind === "percent") {
        const bp = Math.round(Number(value) * 100);
        if (!Number.isFinite(bp) || bp < 0 || bp > 10000) throw new Error("Enter 0–100%");
        onApply({ type: "percent", valueBp: bp });
      } else onApply({ type: "amount", value: parseMoney(value, currency) });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onApply(null)}>
            Remove
          </Button>
          <Button onClick={apply}>Apply</Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex gap-2" role="radiogroup" aria-label="Discount type">
          <Button variant={kind === "percent" ? "primary" : "outline"} aria-pressed={kind === "percent"} onClick={() => setKind("percent")}>
            %
          </Button>
          <Button variant={kind === "amount" ? "primary" : "outline"} aria-pressed={kind === "amount"} onClick={() => setKind("amount")}>
            {currency}
          </Button>
        </div>
        <Field label={kind === "percent" ? "Percent" : "Amount"} htmlFor="disc-value">
          <Input id="disc-value" autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {kind === "percent"
            ? [5, 10, 15, 20, 50].map((p) => (
                <Button key={p} size="sm" variant="secondary" onClick={() => setValue(String(p))}>
                  {p}%
                </Button>
              ))
            : null}
        </div>
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </form>
    </Dialog>
  );
}

/** Override a line's unit price (needs sales.price_override). */
export function PriceDialog({
  open,
  currency,
  price,
  onClose,
  onApply,
}: {
  open: boolean;
  currency: string;
  price: number;
  onClose: () => void;
  onApply: (minor: number) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setValue(toDecimalString(price, currency));
      setError(null);
    }
  }, [open, price, currency]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Change price"
      size="sm"
      footer={
        <Button
          onClick={() => {
            try {
              const v = parseMoney(value, currency);
              if (v < 0) throw new Error("Price must be ≥ 0");
              onApply(v);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Apply
        </Button>
      }
    >
      <Field label={`Unit price (${currency})`} htmlFor="price-value">
        <Input id="price-value" autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </Dialog>
  );
}

/** Find a cached customer or quick-create one (online). */
export function CustomerDialog({
  open,
  customers,
  canCreate,
  onClose,
  onPick,
  onCreate,
}: {
  open: boolean;
  customers: CachedCustomer[];
  canCreate: boolean;
  onClose: () => void;
  onPick: (c: CachedCustomer | null) => void;
  onCreate: (c: { name: string; phone?: string; email?: string }) => Promise<string | null>;
}) {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setQ("");
      setCreating(false);
      setError(null);
    }
  }, [open]);
  const needle = q.trim().toLowerCase();
  const results = (
    needle
      ? customers.filter(
          (c) =>
            c.name.toLowerCase().includes(needle) ||
            (c.phone ?? "").replace(/\s/g, "").includes(needle.replace(/\s/g, "")) ||
            (c.email ?? "").toLowerCase().includes(needle),
        )
      : customers
  ).slice(0, 30);
  return (
    <Dialog open={open} onClose={onClose} title="Customer" size="md">
      {!creating ? (
        <div className="flex flex-col gap-3">
          <Input ref={ref} autoFocus placeholder="Search name, phone or email" aria-label="Search customers" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="flex max-h-72 flex-col overflow-y-auto" aria-label="Customers">
            {results.map((c) => (
              <li key={c.id}>
                <button type="button" className="flex w-full justify-between rounded px-2 py-2 text-left hover:bg-surface-2" onClick={() => onPick(c)}>
                  <span>
                    {c.name} <span className="text-sm text-muted">{c.phone}</span>
                  </span>
                  {c.points ? <span className="text-sm text-muted">{c.points} pts</span> : null}
                </button>
              </li>
            ))}
            {!results.length ? <li className="px-2 py-4 text-sm text-muted">No matching customers</li> : null}
          </ul>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => onPick(null)}>
              Walk-in (no customer)
            </Button>
            {canCreate ? (
              <Button variant="outline" onClick={() => setCreating(true)}>
                New customer
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const err = await onCreate({
              name: String(fd.get("name")),
              phone: String(fd.get("phone") || "") || undefined,
              email: String(fd.get("email") || "") || undefined,
            });
            if (err) setError(err);
          }}
        >
          <Field label="Name" htmlFor="c-name">
            <Input id="c-name" name="name" required autoFocus defaultValue={/\d/.test(q) ? "" : q} />
          </Field>
          <Field label="Phone" htmlFor="c-phone">
            <Input id="c-phone" name="phone" type="tel" defaultValue={/\d/.test(q) ? q : ""} />
          </Field>
          <Field label="Email" htmlFor="c-email">
            <Input id="c-email" name="email" type="email" />
          </Field>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Back
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/** Camera barcode scanning via the BarcodeDetector API (Chromium). */
export function CameraScanner({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const Detector = (globalThis as unknown as { BarcodeDetector?: new (o: unknown) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } })
      .BarcodeDetector;
    if (!Detector) {
      setError("Camera scanning needs a Chromium browser (Chrome, Edge). Use a USB scanner or type the code.");
      return;
    }
    const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            if (codes[0]?.rawValue) {
              onCode(codes[0].rawValue);
              return;
            }
          } catch {
            /* frame not ready */
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError("Could not open the camera. Check the browser permission.");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onCode]);
  return (
    <Dialog open={open} onClose={onClose} title="Scan with camera">
      {error ? (
        <Alert tone="warning">{error}</Alert>
      ) : (
        <video ref={video} className="w-full rounded-lg bg-black" muted playsInline aria-label="Camera preview" />
      )}
    </Dialog>
  );
}
