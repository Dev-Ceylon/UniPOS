"use client";
import { formatMoney } from "@unipos/core";
import { Button, Checkbox, Dialog, Field, Input, Select } from "@unipos/ui";
import { LinkButton } from "@/components/link-button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { emailReceipt } from "@/app/(app)/register/actions";
import { useAction } from "@/components/use-action";
import { clearFlags, refundAction, voidAction } from "../actions";

export function SaleActions({
  sale,
  lines,
  canRefund,
  canVoid,
  currency,
  hasGiftCards,
}: {
  sale: { id: string; isRefund: boolean; status: string; flagged: boolean; customerEmail: string };
  lines: { id: string; name: string; qty: number; refundable: number; total: number }[];
  canRefund: boolean;
  canVoid: boolean;
  currency: string;
  hasGiftCards: boolean;
}) {
  const [dlg, setDlg] = useState<null | "refund" | "void" | "email">(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const { run, pending } = useAction();
  const router = useRouter();
  const anyRefundable = lines.some((l) => l.refundable > 0);
  return (
    <>
      <LinkButton href={`/sales/${sale.id}/receipt`}>Print receipt</LinkButton>
      <LinkButton href={`/api/v1/receipts/${sale.id}/pdf`}>PDF</LinkButton>
      <Button variant="outline" onClick={() => setDlg("email")}>
        Email
      </Button>
      {sale.flagged && canVoid ? (
        <Button variant="outline" loading={pending} onClick={() => run(() => clearFlags(sale.id), { success: "Marked as reviewed" })}>
          Mark reviewed
        </Button>
      ) : null}
      {canRefund && anyRefundable ? (
        <Button
          variant="outline"
          onClick={() => {
            setQty(Object.fromEntries(lines.map((l) => [l.id, l.refundable])));
            setDlg("refund");
          }}
          data-testid="refund-button"
        >
          Refund
        </Button>
      ) : null}
      {canVoid ? (
        <Button variant="danger" onClick={() => setDlg("void")}>
          Void
        </Button>
      ) : null}

      <Dialog open={dlg === "refund"} onClose={() => setDlg(null)} title="Refund items" size="lg">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(
              () =>
                refundAction({
                  saleId: sale.id,
                  lines: lines.map((l) => ({ lineId: l.id, qty: qty[l.id] ?? 0 })),
                  restock: fd.get("restock") === "on",
                  reason: String(fd.get("reason")),
                  tender: String(fd.get("tender")) as "original",
                }),
              {
                success: "Refund recorded",
                onOk: (d) => {
                  setDlg(null);
                  router.push(`/sales/${d.id}`);
                },
              },
            );
          }}
        >
          <ul className="flex flex-col gap-2">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3">
                <span className="text-sm">
                  {l.name}{" "}
                  <span className="text-muted">
                    ({l.refundable} of {l.qty} refundable · {formatMoney(l.total, currency)})
                  </span>
                </span>
                <Input
                  aria-label={`Refund quantity for ${l.name}`}
                  type="number"
                  min={0}
                  max={l.refundable}
                  value={qty[l.id] ?? 0}
                  onChange={(e) => setQty((q) => ({ ...q, [l.id]: Math.max(0, Math.min(l.refundable, Number(e.target.value) || 0)) }))}
                  className="w-20"
                  disabled={l.refundable === 0}
                />
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Refund to" htmlFor="tender">
              <Select id="tender" name="tender" defaultValue="original">
                <option value="original">Original payment methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="wallet">Wallet</option>
                {hasGiftCards ? <option value="gift_card">Gift card</option> : null}
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Reason" htmlFor="reason">
              <Input id="reason" name="reason" required minLength={2} placeholder="Damaged, wrong size…" />
            </Field>
          </div>
          <Checkbox name="restock" defaultChecked label="Return items to stock" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDlg(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!Object.values(qty).some((q) => q > 0)} data-testid="confirm-refund">
              Refund
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={dlg === "void"} onClose={() => setDlg(null)} title="Void sale" size="sm">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason"));
            run(() => voidAction(sale.id, reason), { success: "Sale voided", onOk: () => setDlg(null) });
          }}
        >
          <p className="text-sm text-muted">Voiding reverses stock and balances. It is recorded in the audit log.</p>
          <Field label="Reason" htmlFor="void-reason">
            <Input id="void-reason" name="reason" required minLength={2} />
          </Field>
          <Button type="submit" variant="danger" loading={pending}>
            Void sale
          </Button>
        </form>
      </Dialog>

      <Dialog open={dlg === "email"} onClose={() => setDlg(null)} title="Email receipt" size="sm">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const email = String(new FormData(e.currentTarget).get("email"));
            run(() => emailReceipt(sale.id, email), { success: "Receipt sent", onOk: () => setDlg(null), refresh: false });
          }}
        >
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required defaultValue={sale.customerEmail} />
          </Field>
          <Button type="submit" loading={pending}>
            Send
          </Button>
        </form>
      </Dialog>
    </>
  );
}
