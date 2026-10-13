/** Zod schemas shared by forms and server actions (one validation layer, ADR-008). */
import { z } from "zod";
import { CustomFieldDefSchema } from "./customFields";
import { BUSINESS_TYPES, MODULE_IDS } from "./modules";
import { DEFAULT_RECEIPT_TEMPLATE } from "./receipt";

const minor = z.number().int().safe();
const optionalText = (max = 200) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullish());

export const VariantInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().max(100).default(""),
  sku: optionalText(64),
  barcode: optionalText(64),
  options: z.record(z.string(), z.string()).default({}),
  price: minor.min(0),
  cost: minor.min(0).default(0),
  reorderPoint: z.number().int().min(0).nullish(),
});

export const ProductInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: optionalText(2000),
  categoryId: z.string().nullish(),
  taxClassId: z.string().nullish(),
  type: z.enum(["standard", "kit", "service"]).default("standard"),
  unit: z.string().trim().max(20).default("each"),
  trackStock: z.boolean().default(true),
  favourite: z.boolean().default(false),
  imageUrl: z.preprocess((v) => (v === "" ? null : v), z.string().url().max(1000).nullish()),
  modifierGroupIds: z.array(z.string()).default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
  variants: z.array(VariantInputSchema).min(1, "At least one variant is required").max(100),
});
export type ProductInput = z.infer<typeof ProductInputSchema>;

export const CategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  parentId: z.string().nullish(),
  sortOrder: z.number().int().default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
});

export const TaxRuleInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  rateBp: z.number().int().min(0).max(100_000),
  inclusive: z.boolean().default(false),
  compound: z.boolean().default(false),
  region: optionalText(60),
  priority: z.number().int().default(0),
});

export const TaxClassInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  rules: z.array(TaxRuleInputSchema).max(10),
});

export const CustomerInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: optionalText(40),
  email: z.preprocess((v) => (v === "" ? null : v), z.string().email().max(200).nullish()),
  group: optionalText(60),
  notes: optionalText(2000),
  marketingConsent: z.boolean().default(false),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export const LocationInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(8).regex(/^[A-Z0-9]+$/, "Use capital letters and digits"),
  address: optionalText(500),
  phone: optionalText(40),
  receiptHeader: optionalText(500),
  taxRegion: optionalText(60),
});

export const OnboardingSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  businessType: z.enum(BUSINESS_TYPES),
  currency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.enum(["en", "si", "ta"]).default("en"),
  timezone: z.string().min(1).max(64),
  locationName: z.string().trim().min(1).max(100),
  taxName: z.string().trim().max(40).optional(),
  taxRateBp: z.number().int().min(0).max(100_000).optional(),
  taxInclusive: z.boolean().default(true),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4–6 digits"),
  seedDemo: z.boolean().default(false),
});

export const PinSchema = z.string().regex(/^\d{4,6}$/, "PIN must be 4–6 digits");

export const ReceiptTemplateSchema = z.object({
  header: z.string().max(500).default(""),
  footer: z.string().max(500).default(DEFAULT_RECEIPT_TEMPLATE.footer),
  showTaxBreakdown: z.boolean().default(true),
  showCashier: z.boolean().default(true),
  showBarcode: z.boolean().default(true),
  showCustomer: z.boolean().default(true),
  showTable: z.boolean().default(false),
  logoText: z.string().max(60).default(""),
  paperWidthMm: z.union([z.literal(58), z.literal(80)]).default(80),
});

export const ThemeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1877F2"),
  radius: z.enum(["none", "sm", "md", "lg"]).default("md"),
});

export const TenantSettingsSchema = z.object({
  receipt: ReceiptTemplateSchema.default(ReceiptTemplateSchema.parse({})),
  /** Discounts above this share of the subtotal need `sales.discount_override`. */
  discountThresholdBp: z.number().int().min(0).max(10_000).default(2000),
  allowNegativeStock: z.boolean().default(true),
  loyalty: z
    .object({
      enabled: z.boolean().default(false),
      spendPerPoint: minor.positive().default(10000),
      pointValue: minor.positive().default(100),
      minRedeem: z.number().int().min(0).default(100),
    })
    .default({ enabled: false, spendPerPoint: 10000, pointValue: 100, minRedeem: 100 }),
  customFields: z
    .object({ product: z.array(CustomFieldDefSchema).default([]), customer: z.array(CustomFieldDefSchema).default([]) })
    .default({ product: [], customer: [] }),
  registerLayout: z.enum(["retail", "restaurant"]).default("retail"),
  askCovers: z.boolean().default(false),
  trackStockByDefault: z.boolean().default(true),
  dataRetentionMonths: z.number().int().min(0).max(240).default(0),
  privacyNotice: z.string().max(4000).default(""),
});
export type TenantSettings = z.infer<typeof TenantSettingsSchema>;

export function parseSettings(raw: unknown): TenantSettings {
  const r = TenantSettingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : TenantSettingsSchema.parse({});
}

export const ModulesUpdateSchema = z.object({ modules: z.array(z.enum(MODULE_IDS)) });
