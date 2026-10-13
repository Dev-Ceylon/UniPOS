import "server-only";
import { can, parseSettings, resolveModules, ThemeSchema, type ModuleId, type Permission, type TenantSettings } from "@unipos/core";
import { getPrisma, memberPermissions, withTenant, type TenantContext } from "@unipos/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { verifyCashier } from "./pin";

export const CASHIER_COOKIE = "unipos_cashier";
export const LOCATION_COOKIE = "unipos_location";

export interface AppContext extends TenantContext {
  userId: string;
  userEmail: string;
  sessionMemberId: string;
  /** True when a cashier switched in with their PIN. */
  cashierSwitched: boolean;
  tenant: {
    id: string;
    name: string;
    businessType: string;
    theme: { primary: string; radius: string };
    modules: ModuleId[];
  };
  settings: TenantSettings;
  locations: { id: string; name: string; code: string; taxRegion: string | null; receiptHeader: string | null; address: string | null }[];
  locationId: string;
}

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Resolve the signed-in user's tenant, member, permissions and current location. */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const session = await getSession();
  if (!session) return null;
  const prisma = getPrisma();
  const activeOrg = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId;
  const memberships = await prisma.member.findMany({
    where: { userId: session.user.id, active: true, tenant: { deletedAt: null } },
    include: { tenant: true, user: true },
    orderBy: { createdAt: "asc" },
  });
  const sessionMember = memberships.find((m) => m.tenantId === activeOrg) ?? memberships[0];
  if (!sessionMember) return null;
  const tenant = sessionMember.tenant;
  const store = await cookies();

  // A cashier who switched in with a PIN acts instead of the device's signed-in user.
  const cashierId = verifyCashier(store.get(CASHIER_COOKIE)?.value, tenant.id);
  const actor =
    cashierId && cashierId !== sessionMember.id
      ? ((await prisma.member.findFirst({ where: { id: cashierId, tenantId: tenant.id, active: true }, include: { user: true, tenant: true } })) ?? sessionMember)
      : sessionMember;

  const { permissions, locations } = await withTenant(tenant.id, async (tx) => ({
    permissions: await memberPermissions(tx, actor),
    locations: await tx.location.findMany({ where: { deletedAt: null, active: true }, orderBy: { createdAt: "asc" } }),
  }));
  const allowed = actor.allowedLocationIds.length ? locations.filter((l) => actor.allowedLocationIds.includes(l.id)) : locations;
  const wanted = store.get(LOCATION_COOKIE)?.value;
  const location = allowed.find((l) => l.id === wanted) ?? allowed[0] ?? locations[0];
  const theme = ThemeSchema.safeParse(tenant.theme);
  return {
    tenantId: tenant.id,
    currency: tenant.currency,
    timezone: tenant.timezone,
    locale: tenant.locale,
    settings: parseSettings(tenant.settings),
    enabledModules: resolveModules(tenant.enabledModules),
    member: {
      id: actor.id,
      name: actor.displayName || actor.user.name,
      permissions,
      allowedLocationIds: actor.allowedLocationIds,
    },
    userId: session.user.id,
    userEmail: session.user.email,
    sessionMemberId: sessionMember.id,
    cashierSwitched: actor.id !== sessionMember.id,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      businessType: tenant.businessType,
      theme: theme.success ? theme.data : { primary: "#1877F2", radius: "md" },
      modules: resolveModules(tenant.enabledModules),
    },
    locations: allowed.map((l) => ({ id: l.id, name: l.name, code: l.code, taxRegion: l.taxRegion, receiptHeader: l.receiptHeader, address: l.address })),
    locationId: location?.id ?? "",
  };
});

/** For server pages: require sign-in, a tenant, an enabled module and a permission. */
export async function requireContext(permission?: Permission, module?: ModuleId): Promise<AppContext> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const ctx = await getAppContext();
  if (!ctx) redirect("/onboarding");
  if (module && !ctx.tenant.modules.includes(module)) redirect("/dashboard?module=off");
  if (permission && !can(ctx.member, permission)) redirect("/forbidden");
  return ctx;
}
