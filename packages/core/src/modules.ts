/**
 * Module registry metadata (ADR-002) and business-type presets. The web app
 * attaches routes, nav items and UI to these ids in `apps/web/modules/*`.
 */
import type { Permission } from "./permissions";

export const MODULE_IDS = [
  "core",
  "register",
  "catalog",
  "inventory",
  "customers",
  "loyalty",
  "giftcards",
  "reports",
  "restaurant",
  "multilocation",
  "purchasing",
  "quotes",
  "expenses",
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export interface ModuleMeta {
  id: ModuleId;
  name: string;
  description: string;
  /** Core modules cannot be switched off. */
  required?: boolean;
  dependsOn?: ModuleId[];
}

export const MODULES: Record<ModuleId, ModuleMeta> = {
  core: { id: "core", name: "Core", description: "Business, locations, staff, settings", required: true },
  register: { id: "register", name: "Register", description: "Sell, take payments, print receipts, shifts", required: true },
  catalog: { id: "catalog", name: "Catalog", description: "Products, variants, categories, taxes", required: true },
  inventory: { id: "inventory", name: "Inventory", description: "Stock ledger, adjustments, stocktakes, low stock", dependsOn: ["catalog"] },
  customers: { id: "customers", name: "Customers", description: "Customer profiles and purchase history" },
  loyalty: { id: "loyalty", name: "Loyalty", description: "Earn and redeem points", dependsOn: ["customers"] },
  giftcards: { id: "giftcards", name: "Gift cards", description: "Sell and redeem gift cards" },
  reports: { id: "reports", name: "Reports", description: "Dashboards and exportable reports" },
  restaurant: { id: "restaurant", name: "Restaurant", description: "Tables, modifiers, courses, kitchen display" },
  multilocation: { id: "multilocation", name: "Multi-location", description: "Stock transfers between locations", dependsOn: ["inventory"] },
  purchasing: { id: "purchasing", name: "Purchasing", description: "Suppliers, purchase orders, receiving", dependsOn: ["inventory"] },
  quotes: { id: "quotes", name: "Quotations", description: "Quotes that convert to sales" },
  expenses: { id: "expenses", name: "Expenses", description: "Record business expenses" },
};

export const BUSINESS_TYPES = ["retail", "grocery", "restaurant", "cafe", "services"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export interface BusinessPreset {
  type: BusinessType;
  label: string;
  modules: ModuleId[];
  /** Register layout: product grid with scanner focus, or tables-first. */
  registerLayout: "retail" | "restaurant";
  settings: {
    trackStockByDefault: boolean;
    receiptFooter: string;
    showTableOnReceipt: boolean;
    askCovers: boolean;
  };
}

const CORE: ModuleId[] = ["core", "register", "catalog"];

export const PRESETS: Record<BusinessType, BusinessPreset> = {
  retail: {
    type: "retail",
    label: "Retail shop",
    modules: [...CORE, "inventory", "customers", "loyalty", "giftcards", "reports", "purchasing", "multilocation", "quotes", "expenses"],
    registerLayout: "retail",
    settings: { trackStockByDefault: true, receiptFooter: "Thank you for shopping with us!", showTableOnReceipt: false, askCovers: false },
  },
  grocery: {
    type: "grocery",
    label: "Grocery / supermarket",
    modules: [...CORE, "inventory", "customers", "loyalty", "reports", "purchasing", "multilocation", "expenses"],
    registerLayout: "retail",
    settings: { trackStockByDefault: true, receiptFooter: "Thank you! Please come again.", showTableOnReceipt: false, askCovers: false },
  },
  restaurant: {
    type: "restaurant",
    label: "Restaurant",
    modules: [...CORE, "restaurant", "inventory", "customers", "reports", "purchasing", "expenses", "giftcards"],
    registerLayout: "restaurant",
    settings: { trackStockByDefault: false, receiptFooter: "Thank you for dining with us!", showTableOnReceipt: true, askCovers: true },
  },
  cafe: {
    type: "cafe",
    label: "Café",
    modules: [...CORE, "restaurant", "customers", "loyalty", "reports", "expenses"],
    registerLayout: "restaurant",
    settings: { trackStockByDefault: false, receiptFooter: "Enjoy your coffee!", showTableOnReceipt: true, askCovers: false },
  },
  services: {
    type: "services",
    label: "Services",
    modules: [...CORE, "customers", "reports", "quotes", "expenses", "giftcards"],
    registerLayout: "retail",
    settings: { trackStockByDefault: false, receiptFooter: "Thank you!", showTableOnReceipt: false, askCovers: false },
  },
};

/** Normalize an enabled-module list: add required modules and dependencies. */
export function resolveModules(enabled: readonly string[]): ModuleId[] {
  const set = new Set<ModuleId>();
  const add = (id: ModuleId) => {
    if (set.has(id)) return;
    set.add(id);
    for (const d of MODULES[id].dependsOn ?? []) add(d);
  };
  for (const m of Object.values(MODULES)) if (m.required) add(m.id);
  for (const id of enabled) if ((MODULE_IDS as readonly string[]).includes(id)) add(id as ModuleId);
  return MODULE_IDS.filter((id) => set.has(id));
}

/** Modules that would break if `id` were disabled. */
export function dependents(id: ModuleId, enabled: readonly ModuleId[]): ModuleId[] {
  return enabled.filter((m) => MODULES[m].dependsOn?.includes(id));
}

export interface NavItemMeta {
  href: string;
  labelKey: string;
  icon: string;
  module: ModuleId;
  permission?: Permission;
  order: number;
}

/** Filter nav items by enabled modules and the member's permissions. */
export function visibleNav(items: readonly NavItemMeta[], enabled: readonly ModuleId[], canFn: (p: Permission) => boolean): NavItemMeta[] {
  const on = new Set(resolveModules(enabled));
  return items.filter((i) => on.has(i.module) && (!i.permission || canFn(i.permission))).sort((a, b) => a.order - b.order);
}
