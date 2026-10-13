import { can } from "@unipos/core";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { Shell } from "@/components/shell";
import { requireContext } from "@/lib/context";
import { navFor } from "@/modules/registry";
import { OfflineProvider } from "@/offline/provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const nav = navFor(ctx.tenant.modules, (p) => can(ctx.member, p));
  const locale = await getLocale();
  const theme = (await cookies()).get("unipos_theme")?.value;
  return (
    <OfflineProvider tenantId={ctx.tenantId}>
      <Shell
        tenantName={ctx.tenant.name}
        memberName={ctx.member.name}
        cashierSwitched={ctx.cashierSwitched}
        nav={nav}
        locations={ctx.locations.map((l) => ({ id: l.id, name: l.name }))}
        locationId={ctx.locationId}
        locale={locale}
        theme={theme}
      >
        {children}
      </Shell>
    </OfflineProvider>
  );
}
