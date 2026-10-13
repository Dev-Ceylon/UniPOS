import { can, PERMISSIONS, type Permission } from "@unipos/core";
import { currentShift } from "@unipos/db";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { Register } from "@/components/register/register";

export const metadata = { title: "Register" };

export default async function RegisterPage() {
  const ctx = await requireContext("register.use");
  const location = ctx.locations.find((l) => l.id === ctx.locationId)!;
  const shift = await read(ctx, (tx) => currentShift(tx, ctx.locationId));
  const perms = Object.fromEntries((Object.keys(PERMISSIONS) as Permission[]).map((p) => [p, can(ctx.member, p)])) as Record<Permission, boolean>;
  return (
    <Register
      tenantId={ctx.tenantId}
      tenantName={ctx.tenant.name}
      currency={ctx.currency}
      locale={ctx.locale}
      timeZone={ctx.timezone}
      location={{ id: location.id, name: location.name, code: location.code, address: location.address, receiptHeader: location.receiptHeader }}
      member={{ id: ctx.member.id, name: ctx.member.name }}
      perms={perms}
      modules={ctx.tenant.modules}
      settings={{
        receipt: ctx.settings.receipt,
        discountThresholdBp: ctx.settings.discountThresholdBp,
        loyalty: ctx.settings.loyalty,
        layout: ctx.tenant.modules.includes("restaurant") ? ctx.settings.registerLayout : "retail",
        askCovers: ctx.settings.askCovers,
      }}
      shift={shift ? { id: shift.id, openedAt: shift.openedAt.toISOString() } : null}
    />
  );
}
