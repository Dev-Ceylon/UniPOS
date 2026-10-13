import { DEFAULT_RECEIPT_TEMPLATE, DEFAULT_ROLES, PRESETS, resolveModules, TenantSettingsSchema, type BusinessType } from "@unipos/core";
import { getPrisma, withTenant, type PrismaClient, type Tx } from "../client";
import { writeAudit } from "./audit";
import { recordMovements } from "./stock";

export interface BootstrapInput {
  tenantId: string;
  ownerMemberId: string;
  ownerName: string;
  businessType: BusinessType;
  currency: string;
  locale: string;
  timezone: string;
  locationName: string;
  taxName?: string;
  taxRateBp?: number;
  taxInclusive?: boolean;
  pinHash?: string | null;
  seedDemo?: boolean;
}

/** Settings and module list for a business-type preset. */
export function presetSettings(type: BusinessType, current: unknown = {}) {
  const preset = PRESETS[type];
  const base = TenantSettingsSchema.parse(current ?? {});
  return {
    modules: resolveModules(preset.modules),
    settings: {
      ...base,
      registerLayout: preset.registerLayout,
      askCovers: preset.settings.askCovers,
      trackStockByDefault: preset.settings.trackStockByDefault,
      receipt: { ...DEFAULT_RECEIPT_TEMPLATE, ...base.receipt, footer: preset.settings.receiptFooter, showTable: preset.settings.showTableOnReceipt },
    },
  };
}

export async function ensureDefaultRoles(tx: Tx) {
  const roles: Record<string, string> = {};
  for (const [key, r] of Object.entries(DEFAULT_ROLES)) {
    const role = await tx.role.upsert({
      where: { tenantId_key: { tenantId: await currentTenant(tx), key } },
      create: { key, name: r.name, permissions: r.permissions, system: r.system },
      update: {},
    });
    roles[key] = role.id;
  }
  return roles;
}

async function currentTenant(tx: Tx): Promise<string> {
  const rows = await tx.$queryRaw<{ t: string }[]>`SELECT unipos_current_tenant() AS t`;
  return rows[0]!.t;
}

/** Create roles, first location, taxes and preset settings for a new tenant. */
export async function bootstrapTenant(input: BootstrapInput, client: PrismaClient = getPrisma()) {
  const { modules, settings } = presetSettings(input.businessType);
  await client.tenant.update({
    where: { id: input.tenantId },
    data: { businessType: input.businessType, currency: input.currency, locale: input.locale, timezone: input.timezone, enabledModules: modules, settings },
  });
  return withTenant(
    input.tenantId,
    async (tx) => {
      const roles = await ensureDefaultRoles(tx);
      await client.member.update({
        where: { id: input.ownerMemberId },
        data: { roleId: roles.owner, displayName: input.ownerName, pinHash: input.pinHash ?? undefined },
      });
      const location = await tx.location.create({ data: { name: input.locationName, code: "MAIN" } });
      let taxClassId: string | null = null;
      if (input.taxName && input.taxRateBp) {
        const tc = await tx.taxClass.create({
          data: { name: "Standard", rules: { create: [{ name: input.taxName, rateBp: input.taxRateBp, inclusive: input.taxInclusive ?? true }] } },
        });
        taxClassId = tc.id;
        await tx.taxClass.create({ data: { name: "Zero rated" } });
      }
      await writeAudit(tx, { memberId: input.ownerMemberId, name: input.ownerName }, "tenant.create", "Tenant", input.tenantId, {
        after: { businessType: input.businessType },
      });
      if (input.seedDemo) await seedDemoCatalog(tx, input.businessType, location.id, taxClassId);
      return { locationId: location.id, roles, taxClassId };
    },
    { client, timeout: 60_000 },
  );
}

const RETAIL_DEMO: [string, string, number, number, string | null][] = [
  // name, category, price (minor), cost, barcode
  ["Ceylon Black Tea 100g", "Tea & Coffee", 45000, 30000, "4791234000011"],
  ["Green Tea 50 bags", "Tea & Coffee", 65000, 42000, "4791234000028"],
  ["Instant Coffee 50g", "Tea & Coffee", 89000, 61000, "4791234000035"],
  ["Full Cream Milk Powder 400g", "Dairy", 125000, 98000, "4791234000042"],
  ["Fresh Milk 1L", "Dairy", 52000, 41000, "4791234000059"],
  ["Basmati Rice 1kg", "Grocery", 78000, 59000, "4791234000066"],
  ["Red Raw Rice 5kg", "Grocery", 115000, 92000, "4791234000073"],
  ["Wheat Flour 1kg", "Grocery", 32000, 24000, "4791234000080"],
  ["White Sugar 1kg", "Grocery", 29000, 23000, "4791234000097"],
  ["Coconut Oil 750ml", "Grocery", 98000, 76000, "4791234000103"],
  ["Cream Crackers 190g", "Snacks", 27000, 19000, "4791234000110"],
  ["Chocolate Biscuits 100g", "Snacks", 22000, 15000, "4791234000127"],
  ["Potato Chips 60g", "Snacks", 25000, 16000, "4791234000134"],
  ["Bath Soap 100g", "Household", 18000, 12000, "4791234000141"],
  ["Dishwash Liquid 500ml", "Household", 49000, 35000, "4791234000158"],
  ["Toothpaste 120g", "Household", 39000, 27000, "4791234000165"],
  ["Mineral Water 1.5L", "Beverages", 15000, 9000, "4791234000172"],
  ["Ginger Beer 400ml", "Beverages", 22000, 14000, "4791234000189"],
  ["Orange Juice 1L", "Beverages", 69000, 48000, "4791234000196"],
  ["Gift wrapping", "Services", 20000, 0, null],
];

const RESTAURANT_DEMO: [string, string, number, number, string | null][] = [
  ["Rice & Curry (Chicken)", "Mains", 120000, 55000, null],
  ["Rice & Curry (Vegetable)", "Mains", 85000, 35000, null],
  ["Chicken Kottu", "Mains", 140000, 60000, null],
  ["Egg Hoppers (2)", "Mains", 50000, 15000, null],
  ["Devilled Prawns", "Mains", 220000, 120000, null],
  ["Fish Ambul Thiyal", "Mains", 180000, 90000, null],
  ["String Hoppers (10)", "Sides", 40000, 12000, null],
  ["Pol Sambol", "Sides", 20000, 5000, null],
  ["Watalappan", "Desserts", 55000, 18000, null],
  ["Curd & Treacle", "Desserts", 60000, 25000, null],
  ["Ceylon Tea", "Drinks", 25000, 5000, null],
  ["Iced Coffee", "Drinks", 45000, 15000, null],
  ["Fresh Lime Juice", "Drinks", 40000, 10000, null],
  ["King Coconut", "Drinks", 30000, 12000, null],
];

export async function seedDemoCatalog(tx: Tx, type: BusinessType, locationId: string, taxClassId: string | null) {
  const restaurant = type === "restaurant" || type === "cafe";
  const items = restaurant ? RESTAURANT_DEMO : RETAIL_DEMO;
  const cats = new Map<string, string>();
  let order = 0;
  for (const [, cat] of items) {
    if (!cats.has(cat)) cats.set(cat, (await tx.category.create({ data: { name: cat, sortOrder: order++ } })).id);
  }
  let modifierGroupIds: string[] = [];
  if (restaurant) {
    const spice = await tx.modifierGroup.create({
      data: {
        name: "Spice level",
        minSelect: 0,
        maxSelect: 1,
        modifiers: [
          { name: "Mild", priceDelta: 0 },
          { name: "Medium", priceDelta: 0 },
          { name: "Hot", priceDelta: 0 },
        ],
      },
    });
    const extras = await tx.modifierGroup.create({
      data: {
        name: "Extras",
        minSelect: 0,
        maxSelect: 3,
        modifiers: [
          { name: "Extra egg", priceDelta: 8000 },
          { name: "Extra chicken", priceDelta: 30000 },
          { name: "Papadam", priceDelta: 5000 },
        ],
      },
    });
    modifierGroupIds = [spice.id, extras.id];
    for (let i = 1; i <= 8; i++) {
      await tx.diningTable.create({
        data: {
          locationId,
          name: `T${i}`,
          seats: i % 3 === 0 ? 6 : 4,
          area: i <= 6 ? "Main" : "Terrace",
          x: ((i - 1) % 4) * 140,
          y: Math.floor((i - 1) / 4) * 140,
        },
      });
    }
  }
  let i = 0;
  for (const [name, cat, price, cost, barcode] of items) {
    i++;
    const service = cat === "Services";
    const product = await tx.product.create({
      data: {
        name,
        categoryId: cats.get(cat)!,
        taxClassId,
        type: service ? "service" : "standard",
        trackStock: !restaurant && !service,
        favourite: i <= 8,
        modifierGroupIds: restaurant && cat === "Mains" ? modifierGroupIds : [],
        variants: { create: [{ sku: `${restaurant ? "MENU" : "SKU"}-${String(i).padStart(3, "0")}`, barcode, price, cost }] },
      },
      include: { variants: true },
    });
    if (!restaurant && !service) {
      await recordMovements(tx, [
        { variantId: product.variants[0]!.id, locationId, qtyChange: 80 + ((i * 7) % 40), reason: "opening", note: "Demo opening stock" },
      ]);
      await tx.stockLevel.update({ where: { variantId_locationId: { variantId: product.variants[0]!.id, locationId } }, data: { reorderPoint: 10 } });
    }
  }
  if (!restaurant) {
    await tx.customer.create({ data: { name: "Walk-in Regular", phone: "+94770000001", marketingConsent: true } });
    await tx.supplier.create({ data: { name: "Lanka Wholesale (Pvt) Ltd", phone: "+94112000000", email: "orders@example.com" } });
  }
}
