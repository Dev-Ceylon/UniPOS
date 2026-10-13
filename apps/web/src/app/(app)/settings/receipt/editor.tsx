"use client";
import { buildReceipt, type ReceiptTemplate } from "@unipos/core";
import { Button, Card, CardBody, Checkbox, Field, Input, Select, Textarea } from "@unipos/ui";
import { useMemo, useState } from "react";
import { ReceiptView } from "@/components/receipt-view";
import { useAction } from "@/components/use-action";
import { saveReceipt } from "../actions";

export function ReceiptEditor({ initial, businessName, locationName, address, currency, timeZone }: { initial: ReceiptTemplate; businessName: string; locationName: string; address: string; currency: string; timeZone: string }) {
  const [t, setT] = useState(initial);
  const { run, pending } = useAction();
  const set = <K extends keyof ReceiptTemplate>(k: K, v: ReceiptTemplate[K]) => setT((x) => ({ ...x, [k]: v }));
  const preview = useMemo(
    () =>
      buildReceipt(
        {
          number: "MAIN-0001-00042",
          createdAt: new Date(),
          businessName,
          locationName,
          locationAddress: address,
          cashier: "Nimal",
          customer: "Ashen",
          table: "T4",
          lines: [
            { name: "Ceylon Tea 100g", qty: 2, unitPrice: 45000, total: 90000, discount: 0 },
            { name: "Chicken Kottu", qty: 1, unitPrice: 140000, total: 130000, discount: 10000, modifiers: [{ name: "Extra egg", priceDelta: 0 }] },
          ],
          subtotal: 230000,
          discountTotal: 10000,
          taxes: [{ ruleId: "vat", name: "VAT", rateBp: 1800, inclusive: true, amount: 33559 }],
          taxTotal: 33559,
          total: 220000,
          payments: [{ tender: "cash", amount: 250000 }],
          change: 30000,
          currency,
          timeZone,
        },
        t,
      ),
    [t, businessName, locationName, address, currency, timeZone],
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardBody>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveReceipt(t), { success: "Receipt template saved" });
            }}
          >
            <Field label="Title (defaults to business name)" htmlFor="r-logo">
              <Input id="r-logo" value={t.logoText} onChange={(e) => set("logoText", e.target.value)} maxLength={60} />
            </Field>
            <Field label="Extra header lines" htmlFor="r-header">
              <Textarea id="r-header" value={t.header} onChange={(e) => set("header", e.target.value)} rows={3} />
            </Field>
            <Field label="Footer" htmlFor="r-footer">
              <Textarea id="r-footer" value={t.footer} onChange={(e) => set("footer", e.target.value)} rows={3} />
            </Field>
            <Field label="Paper width" htmlFor="r-width">
              <Select id="r-width" value={t.paperWidthMm} onChange={(e) => set("paperWidthMm", Number(e.target.value) as 58 | 80)}>
                <option value={80}>80 mm</option>
                <option value={58}>58 mm</option>
              </Select>
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox label="Tax breakdown" checked={t.showTaxBreakdown} onChange={(e) => set("showTaxBreakdown", e.target.checked)} />
              <Checkbox label="Cashier name" checked={t.showCashier} onChange={(e) => set("showCashier", e.target.checked)} />
              <Checkbox label="Customer name" checked={t.showCustomer} onChange={(e) => set("showCustomer", e.target.checked)} />
              <Checkbox label="Table (restaurant)" checked={t.showTable} onChange={(e) => set("showTable", e.target.checked)} />
              <Checkbox label="Receipt barcode" checked={t.showBarcode} onChange={(e) => set("showBarcode", e.target.checked)} />
            </div>
            <div>
              <Button type="submit" loading={pending}>
                Save template
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
      <div className="flex justify-center">
        <div className="rounded border border-border shadow-sm" aria-label="Receipt preview">
          <ReceiptView model={preview} width={t.paperWidthMm} />
        </div>
      </div>
    </div>
  );
}
