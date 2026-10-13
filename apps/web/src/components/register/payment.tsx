"use client";
import { formatMoney, parseMoney, quickCashOptions, settleTenders, toDecimalString, uuidv7, type Tender } from "@unipos/core";
import { Alert, Button, Dialog, Input } from "@unipos/ui";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { giftCardBalance } from "@/app/(app)/register/actions";

export interface PaymentLine {
  id: string;
  tender: Tender;
  amount: number;
  reference: string | null;
}

export function PaymentDialog({
  open,
  total,
  currency,
  tenders,
  customerPoints,
  pointValue,
  onClose,
  onComplete,
}: {
  open: boolean;
  total: number;
  currency: string;
  tenders: Tender[];
  customerPoints: number | null;
  pointValue: number;
  onClose: () => void;
  onComplete: (payments: PaymentLine[], change: number) => Promise<void> | void;
}) {
  const t = useTranslations("register");
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [tender, setTender] = useState<Tender>("cash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const m = (v: number) => formatMoney(v, currency);

  useEffect(() => {
    if (open) {
      setPayments([]);
      setTender("cash");
      setReference("");
      setError(null);
      setAmount(toDecimalString(total, currency));
    }
  }, [open, total, currency]);

  const summary = useMemo(() => {
    try {
      return settleTenders(total, payments);
    } catch {
      return null;
    }
  }, [total, payments]);
  const remaining = summary?.remaining ?? total;

  useEffect(() => {
    setAmount(remaining > 0 ? toDecimalString(remaining, currency) : "");
  }, [remaining, currency]);

  async function add(value?: number) {
    setError(null);
    try {
      const amt = value ?? parseMoney(amount, currency);
      if (amt <= 0) throw new Error("Enter an amount");
      if (tender !== "cash" && amt > remaining) throw new Error(`${t(tender)} cannot exceed ${m(remaining)}`);
      if ((tender === "card" || tender === "wallet") && reference && reference.length > 100) throw new Error("Reference too long");
      if (tender === "gift_card") {
        if (!reference.trim()) throw new Error("Enter the gift card code");
        if (navigator.onLine) {
          const res = await giftCardBalance(reference);
          if (!res.ok) throw new Error(res.error);
          if (res.data.balance < amt) throw new Error(`Gift card balance is ${m(res.data.balance)}`);
        }
      }
      if (tender === "points") {
        if (customerPoints === null) throw new Error("Add a customer to pay with points");
        const needed = Math.ceil(amt / pointValue);
        if (needed > customerPoints) throw new Error(`Customer has ${customerPoints} points (${m(customerPoints * pointValue)})`);
      }
      const next = [...payments, { id: uuidv7(), tender, amount: amt, reference: reference.trim() || null }];
      settleTenders(total, next); // validates
      setPayments(next);
      setReference("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const complete = async () => {
    if (!summary?.complete) return;
    setBusy(true);
    try {
      await onComplete(payments, summary.change);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("payment")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Back
          </Button>
          <Button size="lg" variant="success" disabled={!summary?.complete} loading={busy} onClick={complete} data-testid="complete-sale">
            {t("complete")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-surface-2 p-4 text-center">
            <p className="text-sm text-muted">{t("amountDue")}</p>
            <p className="tabular text-3xl font-bold">{m(total)}</p>
            <p className="mt-2 text-sm text-muted">
              {t("remaining")}: <span className="tabular font-semibold text-fg" data-testid="remaining">{m(remaining)}</span>
            </p>
            {summary?.change ? (
              <p className="mt-1 text-lg font-semibold text-success" data-testid="change-due">
                {t("change")}: {m(summary.change)}
              </p>
            ) : null}
          </div>
          <ul className="flex flex-col gap-1" aria-label={t("tendered")}>
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
                <span>
                  {t(p.tender)} {p.reference ? <span className="text-muted">· {p.reference}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular">{m(p.amount)}</span>
                  <Button size="icon" variant="ghost" aria-label="Remove payment" onClick={() => setPayments((ps) => ps.filter((x) => x.id !== p.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tender">
            {tenders.map((tn) => (
              <Button key={tn} variant={tender === tn ? "primary" : "outline"} aria-pressed={tender === tn} onClick={() => setTender(tn)} data-testid={`tender-${tn}`}>
                {t(tn)}
              </Button>
            ))}
          </div>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <label htmlFor="pay-amount" className="text-sm font-medium">
              {t("tendered")} ({currency})
            </label>
            <div className="flex gap-2">
              <Input id="pay-amount" autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg" />
              <Button type="submit" size="lg" disabled={remaining <= 0} data-testid="add-payment">
                Add
              </Button>
            </div>
            {tender !== "cash" ? (
              <Input
                placeholder={tender === "gift_card" ? "Gift card code" : tender === "points" ? "Points note (optional)" : `${t("reference")} (e.g. last 4 digits)`}
                aria-label={t("reference")}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {quickCashOptions(remaining).map((q) => (
                  <Button key={q} variant="secondary" onClick={() => void add(q)} data-testid="quick-cash">
                    {m(q)}
                  </Button>
                ))}
              </div>
            )}
            {tender === "points" && customerPoints !== null ? <p className="text-xs text-muted">Balance: {customerPoints} points = {m(customerPoints * pointValue)}</p> : null}
            {tender === "card" ? <p className="text-xs text-muted">Take the card payment on the separate terminal, then record it here.</p> : null}
          </form>
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </div>
      </div>
    </Dialog>
  );
}
