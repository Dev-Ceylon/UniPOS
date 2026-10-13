import { can, parseSettings, type Permission, type TenantSettings } from "@unipos/core";
import { getPrisma, type PrismaClient, type Tx } from "../client";

/** Everything a server operation needs to know about who is acting. */
export interface TenantContext {
  tenantId: string;
  currency: string;
  timezone: string;
  locale: string;
  settings: TenantSettings;
  enabledModules: string[];
  member: { id: string; name: string; permissions: string[]; allowedLocationIds: string[] };
}

export function ctxCan(ctx: TenantContext, p: Permission): boolean {
  return can(ctx.member, p);
}

/** Load a member's permissions (member table is outside RLS; filter by tenant explicitly). */
export async function loadMemberContext(memberId: string, tenantId: string, client: PrismaClient = getPrisma()): Promise<TenantContext | null> {
  const member = await client.member.findFirst({
    where: { id: memberId, tenantId, active: true },
    include: { user: true, tenant: true },
  });
  if (!member || member.tenant.deletedAt) return null;
  const permissions = await client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return memberPermissions(tx, member);
  });
  return {
    tenantId,
    currency: member.tenant.currency,
    timezone: member.tenant.timezone,
    locale: member.tenant.locale,
    settings: parseSettings(member.tenant.settings),
    enabledModules: member.tenant.enabledModules,
    member: {
      id: member.id,
      name: member.displayName || member.user.name,
      permissions,
      allowedLocationIds: member.allowedLocationIds,
    },
  };
}

export async function memberPermissions(tx: Tx, member: { role: string; roleId: string | null }): Promise<string[]> {
  if (member.role === "owner") return ["*"];
  if (!member.roleId) return [];
  const role = await tx.role.findUnique({ where: { id: member.roleId } });
  return role?.permissions ?? [];
}
