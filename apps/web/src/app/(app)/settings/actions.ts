"use server";
import {
  BUSINESS_TYPES,
  CustomFieldDefSchema,
  dependents,
  isValidGrant,
  LocationInputSchema,
  MODULES,
  PinSchema,
  ReceiptTemplateSchema,
  resolveModules,
  TenantSettingsSchema,
  ThemeSchema,
  type BusinessType,
  type ModuleId,
} from "@unipos/core";
import { getPrisma, presetSettings, writeAudit, type Tx } from "@unipos/db";
import { headers } from "next/headers";
import { z } from "zod";
import { action, UserError } from "@/lib/actions";
import { auth } from "@/lib/auth";
import type { AppContext } from "@/lib/context";
import { hashPin } from "@/lib/pin";

const actor = (ctx: AppContext) => ({ memberId: ctx.member.id, name: ctx.member.name });

async function updateTenant(ctx: AppContext, tx: Tx, data: Record<string, unknown>, auditAction: string) {
  const prisma = getPrisma();
  const before = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
  await prisma.tenant.update({ where: { id: ctx.tenantId }, data });
  await writeAudit(tx, actor(ctx), auditAction, "Tenant", ctx.tenantId, {
    before: Object.fromEntries(Object.keys(data).map((k) => [k, (before as Record<string, unknown>)[k]])),
    after: data,
  });
}

async function currentSettings(ctx: AppContext) {
  const t = await getPrisma().tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
  return TenantSettingsSchema.parse(t.settings ?? {});
}

const GeneralSchema = z.object({
  name: z.string().trim().min(2).max(100),
  currency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.enum(["en", "si", "ta"]),
  timezone: z.string().min(1).max(64),
  discountThresholdBp: z.number().int().min(0).max(10_000),
  allowNegativeStock: z.boolean(),
  trackStockByDefault: z.boolean(),
  askCovers: z.boolean(),
  loyalty: z.object({
    enabled: z.boolean(),
    spendPerPoint: z.number().int().positive(),
    pointValue: z.number().int().positive(),
    minRedeem: z.number().int().min(0),
  }),
  privacyNotice: z.string().max(4000),
  dataRetentionMonths: z.number().int().min(0).max(240),
});

export async function saveGeneral(input: z.infer<typeof GeneralSchema>) {
  return action("settings.edit", async (ctx, tx) => {
    const d = GeneralSchema.parse(input);
    try {
      new Intl.DateTimeFormat("en", { timeZone: d.timezone });
    } catch {
      throw new UserError("Unknown time zone");
    }
    const settings = {
      ...(await currentSettings(ctx)),
      discountThresholdBp: d.discountThresholdBp,
      allowNegativeStock: d.allowNegativeStock,
      trackStockByDefault: d.trackStockByDefault,
      askCovers: d.askCovers,
      loyalty: d.loyalty,
      privacyNotice: d.privacyNotice,
      dataRetentionMonths: d.dataRetentionMonths,
    };
    await updateTenant(ctx, tx, { name: d.name, currency: d.currency, locale: d.locale, timezone: d.timezone, settings }, "settings.general");
    return true;
  });
}

/** Apply a business-type preset: modules, register layout and receipt defaults change with no code change. */
export async function applyPreset(type: string) {
  return action("settings.modules", async (ctx, tx) => {
    if (!(BUSINESS_TYPES as readonly string[]).includes(type)) throw new UserError("Unknown business type");
    const { modules, settings } = presetSettings(type as BusinessType, await currentSettings(ctx));
    await updateTenant(ctx, tx, { businessType: type, enabledModules: modules, settings }, "settings.preset");
    if ((type === "restaurant" || type === "cafe") && (await tx.diningTable.count({ where: { locationId: ctx.locationId } })) === 0) {
      for (let i = 1; i <= 6; i++)
        await tx.diningTable.create({
          data: { locationId: ctx.locationId, name: `T${i}`, x: ((i - 1) % 3) * 140 + 20, y: Math.floor((i - 1) / 3) * 140 + 20 },
        });
    }
    return modules;
  });
}

export async function saveModules(enabled: string[]) {
  return action("settings.modules", async (ctx, tx) => {
    const wanted = new Set(resolveModules(enabled));
    for (const id of wanted) {
      for (const dep of MODULES[id].dependsOn ?? []) if (!wanted.has(dep)) throw new UserError(`${MODULES[id].name} needs ${MODULES[dep].name}`);
    }
    const modules = resolveModules([...wanted]);
    for (const id of ctx.tenant.modules) {
      if (!modules.includes(id)) {
        const broken = dependents(id, modules as ModuleId[]);
        if (broken.length) throw new UserError(`Turn off ${broken.map((b) => MODULES[b].name).join(", ")} first`);
      }
    }
    await updateTenant(ctx, tx, { enabledModules: modules }, "settings.modules");
    return modules;
  });
}

export async function saveReceipt(input: unknown) {
  return action("settings.edit", async (ctx, tx) => {
    const receipt = ReceiptTemplateSchema.parse(input);
    await updateTenant(ctx, tx, { settings: { ...(await currentSettings(ctx)), receipt } }, "settings.receipt");
    return true;
  });
}

export async function saveCustomFields(entity: "product" | "customer", defs: unknown) {
  return action("settings.edit", async (ctx, tx) => {
    const parsed = z.array(CustomFieldDefSchema).max(30).parse(defs);
    if (new Set(parsed.map((d) => d.key)).size !== parsed.length) throw new UserError("Field keys must be unique");
    for (const d of parsed) if (d.type === "select" && !d.options?.length) throw new UserError(`${d.label}: add at least one option`);
    const s = await currentSettings(ctx);
    await updateTenant(ctx, tx, { settings: { ...s, customFields: { ...s.customFields, [entity]: parsed } } }, "settings.customFields");
    return true;
  });
}

export async function saveTheme(input: unknown) {
  return action("settings.edit", async (ctx, tx) => {
    const theme = ThemeSchema.parse(input);
    await updateTenant(ctx, tx, { theme }, "settings.theme");
    return true;
  });
}

export async function saveLocation(id: string | null, input: unknown) {
  return action("settings.edit", async (ctx, tx) => {
    const d = LocationInputSchema.parse(input);
    const data = { ...d, address: d.address ?? null, phone: d.phone ?? null, receiptHeader: d.receiptHeader ?? null, taxRegion: d.taxRegion ?? null };
    const l = id ? await tx.location.update({ where: { id }, data }) : await tx.location.create({ data });
    await writeAudit(tx, actor(ctx), id ? "location.update" : "location.create", "Location", l.id, { after: data });
    return l.id;
  });
}

export async function archiveLocation(id: string) {
  return action("settings.edit", async (ctx, tx) => {
    if ((await tx.location.count({ where: { deletedAt: null, active: true } })) <= 1) throw new UserError("You need at least one location");
    await tx.location.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
    await writeAudit(tx, actor(ctx), "location.archive", "Location", id);
    return true;
  });
}

// ── Staff & roles ──

export async function inviteMember(email: string, roleId: string) {
  return action("members.manage", async (ctx, tx) => {
    const e = z.string().email().parse(email.trim().toLowerCase());
    const role = await tx.role.findUnique({ where: { id: roleId } });
    if (!role) throw new UserError("Choose a role");
    if (role.key === "owner") throw new UserError("Owners cannot be invited; transfer ownership instead");
    const h = await headers();
    try {
      await auth.api.createInvitation({ body: { email: e, role: "member", organizationId: ctx.tenantId, roleId, resend: true } as never, headers: h });
    } catch (err) {
      throw new UserError((err as Error).message || "Could not send the invitation");
    }
    await writeAudit(tx, actor(ctx), "member.invite", "Invitation", null, { after: { email: e, role: role.key } });
    return true;
  });
}

export async function cancelInvite(id: string) {
  return action("members.manage", async (ctx) => {
    await getPrisma().invitation.updateMany({ where: { id, tenantId: ctx.tenantId }, data: { status: "canceled" } });
    return true;
  });
}

const MemberUpdate = z.object({
  roleId: z.string(),
  displayName: z.string().trim().min(1).max(60),
  active: z.boolean(),
  allowedLocationIds: z.array(z.string()),
  pin: z.union([z.literal(""), PinSchema]),
});

export async function updateMember(memberId: string, input: z.infer<typeof MemberUpdate>) {
  return action("members.manage", async (ctx, tx) => {
    const d = MemberUpdate.parse(input);
    const prisma = getPrisma();
    const m = await prisma.member.findFirst({ where: { id: memberId, tenantId: ctx.tenantId } });
    if (!m) throw new UserError("Member not found");
    const role = await tx.role.findUnique({ where: { id: d.roleId } });
    if (!role) throw new UserError("Unknown role");
    if (m.role === "owner" && (role.key !== "owner" || !d.active)) throw new UserError("The owner keeps the Owner role and stays active");
    if (role.key === "owner" && m.role !== "owner") throw new UserError("Only one owner per business");
    await prisma.member.update({
      where: { id: m.id },
      data: {
        roleId: d.roleId,
        displayName: d.displayName,
        active: d.active,
        allowedLocationIds: d.allowedLocationIds,
        ...(d.pin ? { pinHash: await hashPin(d.pin), failedPinAttempts: 0, pinLockedUntil: null } : {}),
      },
    });
    await writeAudit(tx, actor(ctx), "member.update", "Member", m.id, {
      before: { roleId: m.roleId, active: m.active },
      after: { roleId: d.roleId, active: d.active, pinChanged: !!d.pin },
    });
    return true;
  });
}

const RoleSchema = z.object({ name: z.string().trim().min(1).max(40), permissions: z.array(z.string()).max(100) });

export async function saveRole(id: string | null, input: unknown) {
  return action("members.manage", async (ctx, tx) => {
    const d = RoleSchema.parse(input);
    const bad = d.permissions.filter((p) => !isValidGrant(p));
    if (bad.length) throw new UserError(`Unknown permissions: ${bad.join(", ")}`);
    if (id) {
      const r = await tx.role.findUnique({ where: { id } });
      if (r?.key === "owner") throw new UserError("The Owner role always has every permission");
      await tx.role.update({ where: { id }, data: d });
    } else {
      const key = `${d.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .slice(0, 30)}_${Date.now().toString(36)}`;
      id = (await tx.role.create({ data: { ...d, key } })).id;
    }
    await writeAudit(tx, actor(ctx), "role.save", "Role", id, { after: d });
    return id;
  });
}

export async function deleteRole(id: string) {
  return action("members.manage", async (ctx, tx) => {
    const r = await tx.role.findUnique({ where: { id } });
    if (!r || r.system) throw new UserError("Built-in roles cannot be deleted");
    if (await getPrisma().member.count({ where: { tenantId: ctx.tenantId, roleId: id } })) throw new UserError("Move staff off this role first");
    await tx.role.delete({ where: { id } });
    await writeAudit(tx, actor(ctx), "role.delete", "Role", id);
    return true;
  });
}
