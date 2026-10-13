"use client";
import { BUSINESS_TYPES, parseMoney, PRESETS } from "@unipos/core";
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Checkbox, Field, Input, Select, Textarea } from "@unipos/ui";
import { useState } from "react";
import { toast } from "sonner";
import { useAction } from "@/components/use-action";
import { applyPreset, saveGeneral } from "./actions";

type Init = {
  name: string;
  currency: string;
  locale: string;
  timezone: string;
  discountThreshold: string;
  allowNegativeStock: boolean;
  trackStockByDefault: boolean;
  askCovers: boolean;
  loyaltyEnabled: boolean;
  spendPerPoint: string;
  pointValue: string;
  minRedeem: string;
  privacyNotice: string;
  dataRetentionMonths: string;
};

export function GeneralForm({ initial, readOnly, loyaltyModule }: { initial: Init; readOnly: boolean; loyaltyModule: boolean }) {
  const [f, setF] = useState(initial);
  const { run, pending } = useAction();
  const set = <K extends keyof Init>(k: K, v: Init[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const payload = {
            name: f.name,
            currency: f.currency,
            locale: f.locale as "en",
            timezone: f.timezone,
            discountThresholdBp: Math.round(Number(f.discountThreshold) * 100),
            allowNegativeStock: f.allowNegativeStock,
            trackStockByDefault: f.trackStockByDefault,
            askCovers: f.askCovers,
            loyalty: { enabled: f.loyaltyEnabled, spendPerPoint: parseMoney(f.spendPerPoint, f.currency), pointValue: parseMoney(f.pointValue, f.currency), minRedeem: Number(f.minRedeem) || 0 },
            privacyNotice: f.privacyNotice,
            dataRetentionMonths: Number(f.dataRetentionMonths) || 0,
          };
          run(() => saveGeneral(payload), { success: "Settings saved" });
        } catch (err) {
          toast.error((err as Error).message);
        }
      }}
    >
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" htmlFor="g-name" className="sm:col-span-2">
              <Input id="g-name" value={f.name} onChange={(e) => set("name", e.target.value)} required />
            </Field>
            <Field label="Currency" htmlFor="g-cur" hint="Changing currency does not convert existing prices.">
              <Input id="g-cur" value={f.currency} maxLength={3} onChange={(e) => set("currency", e.target.value.toUpperCase())} required />
            </Field>
            <Field label="Default language" htmlFor="g-locale">
              <Select id="g-locale" value={f.locale} onChange={(e) => set("locale", e.target.value)}>
                <option value="en">English</option>
                <option value="si">සිංහල</option>
                <option value="ta">தமிழ்</option>
              </Select>
            </Field>
            <Field label="Time zone" htmlFor="g-tz">
              <Input id="g-tz" value={f.timezone} onChange={(e) => set("timezone", e.target.value)} required />
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Register & stock</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Discount limit without manager (%)" htmlFor="g-disc" hint="Larger discounts need the “Apply discounts above the threshold” permission.">
              <Input id="g-disc" inputMode="decimal" value={f.discountThreshold} onChange={(e) => set("discountThreshold", e.target.value)} />
            </Field>
            <div className="flex flex-col gap-2 pt-6">
              <Checkbox label="Allow selling below zero stock (flagged for review)" checked={f.allowNegativeStock} onChange={(e) => set("allowNegativeStock", e.target.checked)} />
              <Checkbox label="Track stock for new products by default" checked={f.trackStockByDefault} onChange={(e) => set("trackStockByDefault", e.target.checked)} />
              <Checkbox label="Ask number of guests when opening a table" checked={f.askCovers} onChange={(e) => set("askCovers", e.target.checked)} />
            </div>
          </CardBody>
        </Card>
        {loyaltyModule ? (
          <Card>
            <CardHeader>
              <CardTitle>Loyalty</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <Checkbox className="sm:col-span-3" label="Customers earn points on purchases" checked={f.loyaltyEnabled} onChange={(e) => set("loyaltyEnabled", e.target.checked)} />
              <Field label={`Spend per point (${f.currency})`} htmlFor="g-spp">
                <Input id="g-spp" inputMode="decimal" value={f.spendPerPoint} onChange={(e) => set("spendPerPoint", e.target.value)} />
              </Field>
              <Field label={`Value of 1 point (${f.currency})`} htmlFor="g-pv">
                <Input id="g-pv" inputMode="decimal" value={f.pointValue} onChange={(e) => set("pointValue", e.target.value)} />
              </Field>
              <Field label="Minimum points to redeem" htmlFor="g-min">
                <Input id="g-min" inputMode="numeric" value={f.minRedeem} onChange={(e) => set("minRedeem", e.target.value)} />
              </Field>
            </CardBody>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Personal data</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4">
            <Alert>Customer names, phones and purchase history are personal data (Sri Lanka PDPA). Confirm obligations with a legal adviser.</Alert>
            <Field label="Privacy notice shown to customers" htmlFor="g-privacy">
              <Textarea id="g-privacy" value={f.privacyNotice} onChange={(e) => set("privacyNotice", e.target.value)} rows={4} placeholder="We keep your name and phone number to give you loyalty points…" />
            </Field>
            <Field label="Retention (months, 0 = keep)" htmlFor="g-ret" hint="Customers inactive longer than this are listed for review.">
              <Input id="g-ret" inputMode="numeric" value={f.dataRetentionMonths} onChange={(e) => set("dataRetentionMonths", e.target.value)} className="w-32" />
            </Field>
          </CardBody>
        </Card>
        {!readOnly ? (
          <div>
            <Button type="submit" loading={pending}>
              Save settings
            </Button>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}

export function PresetSwitcher({ current }: { current: string }) {
  const [type, setType] = useState(current);
  const { run, pending } = useAction();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Business type</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-wrap items-end gap-3">
        <Field label="Preset" htmlFor="preset" hint="Switches modules, register layout and receipt defaults. Your data is kept.">
          <Select id="preset" value={type} onChange={(e) => setType(e.target.value)} className="w-56">
            {BUSINESS_TYPES.map((b) => (
              <option key={b} value={b}>
                {PRESETS[b].label}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="outline" disabled={type === current} loading={pending} onClick={() => run(() => applyPreset(type), { success: `Switched to ${PRESETS[type as keyof typeof PRESETS].label}` })} data-testid="apply-preset">
          Apply preset
        </Button>
      </CardBody>
    </Card>
  );
}
