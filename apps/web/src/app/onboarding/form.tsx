"use client";
import { BUSINESS_TYPES, PRESETS } from "@unipos/core";
import { Alert, Button, Card, Checkbox, Field, Input, Select } from "@unipos/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { createBusiness } from "./actions";

const CURRENCIES = ["LKR", "USD", "EUR", "GBP", "INR", "AUD", "SGD", "AED", "JPY"];

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Colombo";
  return (
    <Card className="p-6">
      <h1 className="mb-1 text-2xl font-semibold">{t("title")}</h1>
      <p className="mb-6 text-sm text-muted">Takes about a minute. You can change everything later in Settings.</p>
      <form
        className="grid gap-4 sm:grid-cols-2"
        action={(fd) =>
          start(async () => {
            setError(null);
            const res = await createBusiness({
              businessName: String(fd.get("businessName")),
              businessType: String(fd.get("businessType")),
              currency: String(fd.get("currency")),
              locale: String(fd.get("locale")),
              timezone: String(fd.get("timezone")),
              locationName: String(fd.get("locationName")),
              taxName: String(fd.get("taxName") ?? ""),
              taxRate: String(fd.get("taxRate") ?? ""),
              taxInclusive: fd.get("taxInclusive") === "on",
              pin: String(fd.get("pin")),
              seedDemo: fd.get("seedDemo") === "on",
            });
            if (!res.ok) setError(res.error);
            else {
              router.replace("/dashboard");
              router.refresh();
            }
          })
        }
      >
        <Field label={t("businessName")} htmlFor="businessName" className="sm:col-span-2">
          <Input id="businessName" name="businessName" required minLength={2} defaultValue={`${defaultName.split(" ")[0]}'s Shop`} />
        </Field>
        <Field label={t("businessType")} htmlFor="businessType">
          <Select id="businessType" name="businessType" defaultValue="retail">
            {BUSINESS_TYPES.map((b) => (
              <option key={b} value={b}>
                {PRESETS[b].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("currency")} htmlFor="currency">
          <Select id="currency" name="currency" defaultValue="LKR">
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("timezone")} htmlFor="timezone">
          <Input id="timezone" name="timezone" defaultValue={tz} required />
        </Field>
        <Field label={t("language")} htmlFor="locale">
          <Select id="locale" name="locale" defaultValue="en">
            <option value="en">English</option>
            <option value="si">සිංහල</option>
            <option value="ta">தமிழ்</option>
          </Select>
        </Field>
        <Field label={t("locationName")} htmlFor="locationName" className="sm:col-span-2">
          <Input id="locationName" name="locationName" defaultValue="Main store" required />
        </Field>
        <fieldset className="grid gap-4 rounded-lg border border-border p-4 sm:col-span-2 sm:grid-cols-3">
          <legend className="px-1 text-sm font-medium">{t("tax")}</legend>
          <Field label={t("taxName")} htmlFor="taxName">
            <Input id="taxName" name="taxName" defaultValue="VAT" />
          </Field>
          <Field label={t("taxRate")} htmlFor="taxRate">
            <Input id="taxRate" name="taxRate" inputMode="decimal" defaultValue="18" />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox name="taxInclusive" defaultChecked label={t("taxInclusive")} />
          </div>
        </fieldset>
        <Field label={t("pin")} htmlFor="pin">
          <Input id="pin" name="pin" inputMode="numeric" pattern="\d{4,6}" required autoComplete="off" />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox name="seedDemo" defaultChecked label={t("demo")} />
        </div>
        {error ? (
          <div className="sm:col-span-2">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
        <Button type="submit" size="lg" loading={pending} className="sm:col-span-2">
          {t("submit")}
        </Button>
      </form>
    </Card>
  );
}
