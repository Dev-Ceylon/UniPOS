import "server-only";
import type { Tx } from "@unipos/db";
import type { AppContext } from "@/lib/context";

export async function formOptions(ctx: AppContext, tx: Tx) {
  const [categories, taxClasses, modifierGroups] = await Promise.all([
    tx.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    tx.taxClass.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ctx.tenant.modules.includes("restaurant") ? tx.modifierGroup.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }) : Promise.resolve(null),
  ]);
  return { categories, taxClasses, modifierGroups };
}
