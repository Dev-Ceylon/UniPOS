"use server";
import { action } from "./actions";

export interface VariantHit {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost: number;
  onHand: number;
}

/** Product/variant lookup for back-office forms (transfers, POs, quotes, stocktakes). */
export async function searchVariants(q: string) {
  return action("products.view", async (ctx, tx) => {
    const term = q.trim();
    if (!term) return [] as VariantHit[];
    const vs = await tx.variant.findMany({
      where: {
        deletedAt: null,
        product: { deletedAt: null },
        OR: [{ barcode: term }, { sku: { contains: term, mode: "insensitive" } }, { product: { name: { contains: term, mode: "insensitive" } } }, { name: { contains: term, mode: "insensitive" } }],
      },
      include: { product: true, stockLevels: { where: { locationId: ctx.locationId } } },
      take: 20,
      orderBy: { product: { name: "asc" } },
    });
    return vs.map<VariantHit>((v) => ({
      id: v.id,
      name: v.name ? `${v.product.name} — ${v.name}` : v.product.name,
      sku: v.sku,
      barcode: v.barcode,
      price: v.price,
      cost: v.cost,
      onHand: v.stockLevels[0]?.onHand ?? 0,
    }));
  });
}

export async function searchCustomers(q: string) {
  return action("customers.view", async (_ctx, tx) => {
    const term = q.trim();
    if (!term) return [];
    return tx.customer.findMany({
      where: { deletedAt: null, OR: [{ name: { contains: term, mode: "insensitive" } }, { phone: { contains: term } }, { email: { contains: term, mode: "insensitive" } }] },
      select: { id: true, name: true, phone: true, email: true },
      take: 15,
    });
  });
}
