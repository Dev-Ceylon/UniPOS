import { toDecimalString } from "@unipos/core";

export interface ProductFormData {
  id: string | null;
  name: string;
  description: string;
  categoryId: string;
  taxClassId: string;
  type: "standard" | "kit" | "service";
  unit: string;
  trackStock: boolean;
  favourite: boolean;
  imageUrl: string;
  modifierGroupIds: string[];
  customFields: Record<string, unknown>;
  variants: { id?: string; name: string; sku: string; barcode: string; price: string; cost: string; opening: string }[];
}

export function toFormData(
  p: {
    id: string;
    name: string;
    description: string | null;
    categoryId: string | null;
    taxClassId: string | null;
    type: string;
    unit: string;
    trackStock: boolean;
    favourite: boolean;
    imageUrl: string | null;
    modifierGroupIds: string[];
    customFields: unknown;
    variants: { id: string; name: string; sku: string | null; barcode: string | null; price: number; cost: number }[];
  },
  currency: string,
): ProductFormData {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    categoryId: p.categoryId ?? "",
    taxClassId: p.taxClassId ?? "",
    type: p.type as ProductFormData["type"],
    unit: p.unit,
    trackStock: p.trackStock,
    favourite: p.favourite,
    imageUrl: p.imageUrl ?? "",
    modifierGroupIds: p.modifierGroupIds,
    customFields: (p.customFields as Record<string, unknown>) ?? {},
    variants: p.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku ?? "", barcode: v.barcode ?? "", price: toDecimalString(v.price, currency), cost: toDecimalString(v.cost, currency), opening: "" })),
  };
}
