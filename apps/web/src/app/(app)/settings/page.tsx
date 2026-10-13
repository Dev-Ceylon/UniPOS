import { can, toDecimalString } from "@unipos/core";
import { PageHeader } from "@unipos/ui";
import { requireContext } from "@/lib/context";
import { GeneralForm, PresetSwitcher } from "./general-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireContext("settings.view");
  const s = ctx.settings;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Business settings" />
      {can(ctx.member, "settings.modules") ? <PresetSwitcher current={ctx.tenant.businessType} /> : null}
      <GeneralForm
        readOnly={!can(ctx.member, "settings.edit")}
        initial={{
          name: ctx.tenant.name,
          currency: ctx.currency,
          locale: ctx.locale,
          timezone: ctx.timezone,
          discountThreshold: String(s.discountThresholdBp / 100),
          allowNegativeStock: s.allowNegativeStock,
          trackStockByDefault: s.trackStockByDefault,
          askCovers: s.askCovers,
          loyaltyEnabled: s.loyalty.enabled,
          spendPerPoint: toDecimalString(s.loyalty.spendPerPoint, ctx.currency),
          pointValue: toDecimalString(s.loyalty.pointValue, ctx.currency),
          minRedeem: String(s.loyalty.minRedeem),
          privacyNotice: s.privacyNotice,
          dataRetentionMonths: String(s.dataRetentionMonths),
        }}
        loyaltyModule={ctx.tenant.modules.includes("loyalty")}
      />
    </div>
  );
}
