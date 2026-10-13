import { adjustmentFor, can, ForbiddenError, stocktakeVariances, type Permission, type StockReason } from "@unipos/core";
import type { Tx } from "../client";
import { writeAudit } from "./audit";
import type { TenantContext } from "./context";
import { nextNumber } from "./counters";
import { recordMovements } from "./stock";

export class InventoryError extends Error {}

function need(ctx: TenantContext, p: Permission) {
  if (!can(ctx.member, p)) throw new ForbiddenError(p);
}
const actor = (ctx: TenantContext) => ({ memberId: ctx.member.id, name: ctx.member.name });

export async function onHand(tx: Tx, variantId: string, locationId: string) {
  const l = await tx.stockLevel.findUnique({ where: { variantId_locationId: { variantId, locationId } } });
  return l?.onHand ?? 0;
}

/** Adjust stock by a delta or set it to a counted value, with a reason. */
export async function adjustStock(
  tx: Tx,
  ctx: TenantContext,
  input: { variantId: string; locationId: string; mode: "delta" | "set"; qty: number; reason: StockReason; note?: string },
) {
  need(ctx, "inventory.adjust");
  if (!Number.isInteger(input.qty)) throw new InventoryError("Quantity must be a whole number");
  const current = await onHand(tx, input.variantId, input.locationId);
  const delta = input.mode === "set" ? adjustmentFor(current, input.qty) : input.qty;
  if (delta === 0) return current;
  const res = await recordMovements(tx, [{ variantId: input.variantId, locationId: input.locationId, qtyChange: delta, reason: input.reason, note: input.note, refType: "adjustment", memberId: ctx.member.id }]);
  await writeAudit(tx, actor(ctx), "stock.adjust", "Variant", input.variantId, { before: { onHand: current }, after: { onHand: current + delta, reason: input.reason, note: input.note } });
  return res.get(`${input.variantId}:${input.locationId}`) ?? current + delta;
}

export async function setReorderPoint(tx: Tx, ctx: TenantContext, variantId: string, locationId: string, reorderPoint: number | null) {
  need(ctx, "inventory.adjust");
  await tx.stockLevel.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    create: { variantId, locationId, onHand: 0, reorderPoint },
    update: { reorderPoint },
  });
}

// ── Stocktakes ──

export async function startStocktake(tx: Tx, ctx: TenantContext, locationId: string, categoryId?: string | null, note?: string) {
  need(ctx, "inventory.stocktake");
  const variants = await tx.variant.findMany({
    where: { deletedAt: null, product: { deletedAt: null, trackStock: true, ...(categoryId ? { categoryId } : {}) } },
    include: { stockLevels: { where: { locationId } } },
  });
  const st = await tx.stocktake.create({
    data: {
      locationId,
      note,
      createdById: ctx.member.id,
      lines: { create: variants.map((v) => ({ variantId: v.id, expected: v.stockLevels[0]?.onHand ?? 0 })) },
    },
  });
  await writeAudit(tx, actor(ctx), "stocktake.start", "Stocktake", st.id);
  return st;
}

export async function recordCounts(tx: Tx, ctx: TenantContext, stocktakeId: string, counts: { variantId: string; counted: number | null }[]) {
  need(ctx, "inventory.stocktake");
  const st = await tx.stocktake.findUnique({ where: { id: stocktakeId } });
  if (!st || st.status !== "open") throw new InventoryError("Stocktake is not open");
  for (const c of counts) {
    if (c.counted !== null && (!Number.isInteger(c.counted) || c.counted < 0)) throw new InventoryError("Counts must be whole numbers ≥ 0");
    await tx.stocktakeLine.updateMany({ where: { stocktakeId, variantId: c.variantId }, data: { counted: c.counted } });
  }
}

/**
 * Complete a stocktake. Variance = counted − expected, applied as a movement on
 * top of current on-hand so sales during the count are not lost.
 */
export async function completeStocktake(tx: Tx, ctx: TenantContext, stocktakeId: string) {
  need(ctx, "inventory.stocktake");
  const st = await tx.stocktake.findUnique({ where: { id: stocktakeId }, include: { lines: true } });
  if (!st || st.status !== "open") throw new InventoryError("Stocktake is not open");
  const variances = stocktakeVariances(st.lines);
  await recordMovements(
    tx,
    variances.map((v) => ({ variantId: v.variantId, locationId: st.locationId, qtyChange: v.variance, reason: "stocktake" as const, refType: "stocktake", refId: st.id, memberId: ctx.member.id })),
  );
  await tx.stocktake.update({ where: { id: st.id }, data: { status: "completed", completedAt: new Date() } });
  await writeAudit(tx, actor(ctx), "stocktake.complete", "Stocktake", st.id, { after: { variances } });
  return variances;
}

// ── Transfers (multi-location, in-transit state) ──

export async function createTransfer(tx: Tx, ctx: TenantContext, input: { fromLocationId: string; toLocationId: string; lines: { variantId: string; qty: number }[]; note?: string }) {
  need(ctx, "inventory.transfer");
  if (input.fromLocationId === input.toLocationId) throw new InventoryError("Choose two different locations");
  const lines = input.lines.filter((l) => l.qty > 0);
  if (!lines.length) throw new InventoryError("Add at least one item");
  const variants = await tx.variant.findMany({ where: { id: { in: lines.map((l) => l.variantId) } }, include: { product: true } });
  const name = new Map(variants.map((v) => [v.id, v.name ? `${v.product.name} — ${v.name}` : v.product.name]));
  const number = await nextNumber(tx, "transfer", "TR");
  return tx.transfer.create({
    data: {
      number,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      note: input.note,
      lines: { create: lines.map((l) => ({ variantId: l.variantId, qty: l.qty, name: name.get(l.variantId) ?? "?" })) },
    },
  });
}

/** Send: stock leaves the source and is in transit. */
export async function sendTransfer(tx: Tx, ctx: TenantContext, transferId: string) {
  need(ctx, "inventory.transfer");
  const t = await tx.transfer.findUnique({ where: { id: transferId }, include: { lines: true } });
  if (!t || t.status !== "draft") throw new InventoryError("Only draft transfers can be sent");
  await recordMovements(tx, t.lines.map((l) => ({ variantId: l.variantId, locationId: t.fromLocationId, qtyChange: -l.qty, reason: "transfer_out" as const, refType: "transfer", refId: t.id, memberId: ctx.member.id })));
  await tx.transfer.update({ where: { id: t.id }, data: { status: "in_transit", sentAt: new Date() } });
  await writeAudit(tx, actor(ctx), "transfer.send", "Transfer", t.id);
}

/** Receive: stock arrives at the destination (partial receipts allowed). */
export async function receiveTransfer(tx: Tx, ctx: TenantContext, transferId: string, received?: Record<string, number>) {
  need(ctx, "inventory.transfer");
  const t = await tx.transfer.findUnique({ where: { id: transferId }, include: { lines: true } });
  if (!t || t.status !== "in_transit") throw new InventoryError("Transfer is not in transit");
  const moves = t.lines.map((l) => {
    const q = received?.[l.id] ?? l.qty;
    if (!Number.isInteger(q) || q < 0 || q > l.qty) throw new InventoryError("Received quantity out of range");
    return { line: l, q };
  });
  await recordMovements(tx, moves.map(({ line, q }) => ({ variantId: line.variantId, locationId: t.toLocationId, qtyChange: q, reason: "transfer_in" as const, refType: "transfer", refId: t.id, memberId: ctx.member.id })));
  // anything not received is written back to the source as lost in transit? No: return to source.
  const shortfall = moves.filter(({ line, q }) => q < line.qty);
  await recordMovements(tx, shortfall.map(({ line, q }) => ({ variantId: line.variantId, locationId: t.fromLocationId, qtyChange: line.qty - q, reason: "transfer_in" as const, refType: "transfer", refId: t.id, note: "Returned: not received", memberId: ctx.member.id })));
  for (const { line, q } of moves) await tx.transferLine.update({ where: { id: line.id }, data: { qtyReceived: q } });
  await tx.transfer.update({ where: { id: t.id }, data: { status: "received", receivedAt: new Date() } });
  await writeAudit(tx, actor(ctx), "transfer.receive", "Transfer", t.id);
}

export async function cancelTransfer(tx: Tx, ctx: TenantContext, transferId: string) {
  need(ctx, "inventory.transfer");
  const t = await tx.transfer.findUnique({ where: { id: transferId }, include: { lines: true } });
  if (!t || (t.status !== "draft" && t.status !== "in_transit")) throw new InventoryError("Transfer cannot be cancelled");
  if (t.status === "in_transit") {
    await recordMovements(tx, t.lines.map((l) => ({ variantId: l.variantId, locationId: t.fromLocationId, qtyChange: l.qty, reason: "transfer_in" as const, refType: "transfer", refId: t.id, note: "Cancelled", memberId: ctx.member.id })));
  }
  await tx.transfer.update({ where: { id: t.id }, data: { status: "cancelled" } });
}

// ── Purchase orders ──

export async function createPurchaseOrder(tx: Tx, ctx: TenantContext, input: { supplierId: string; locationId: string; expectedAt?: Date | null; note?: string; lines: { variantId: string; qty: number; unitCost: number }[] }) {
  need(ctx, "purchasing.manage");
  const lines = input.lines.filter((l) => l.qty > 0);
  if (!lines.length) throw new InventoryError("Add at least one item");
  const variants = await tx.variant.findMany({ where: { id: { in: lines.map((l) => l.variantId) } }, include: { product: true } });
  const name = new Map(variants.map((v) => [v.id, v.name ? `${v.product.name} — ${v.name}` : v.product.name]));
  const number = await nextNumber(tx, "po", "PO");
  return tx.purchaseOrder.create({
    data: {
      number,
      supplierId: input.supplierId,
      locationId: input.locationId,
      expectedAt: input.expectedAt ?? null,
      note: input.note,
      total: lines.reduce((a, l) => a + l.qty * l.unitCost, 0),
      lines: { create: lines.map((l) => ({ variantId: l.variantId, name: name.get(l.variantId) ?? "?", qtyOrdered: l.qty, unitCost: l.unitCost })) },
    },
  });
}

export async function markOrdered(tx: Tx, ctx: TenantContext, poId: string) {
  need(ctx, "purchasing.manage");
  const po = await tx.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po || po.status !== "draft") throw new InventoryError("Only drafts can be ordered");
  await tx.purchaseOrder.update({ where: { id: poId }, data: { status: "ordered" } });
}

/** Receive goods into stock; updates variant cost to the latest unit cost. */
export async function receivePurchaseOrder(tx: Tx, ctx: TenantContext, poId: string, received: Record<string, number>) {
  need(ctx, "purchasing.manage");
  const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: true } });
  if (!po || !["ordered", "partial"].includes(po.status)) throw new InventoryError("Order is not open for receiving");
  const moves = [];
  for (const l of po.lines) {
    const q = received[l.id] ?? 0;
    if (!Number.isInteger(q) || q < 0 || q > l.qtyOrdered - l.qtyReceived) throw new InventoryError(`Received quantity out of range for ${l.name}`);
    if (q === 0) continue;
    moves.push({ variantId: l.variantId, locationId: po.locationId, qtyChange: q, reason: "receive" as const, refType: "purchase_order", refId: po.id, memberId: ctx.member.id });
    await tx.purchaseOrderLine.update({ where: { id: l.id }, data: { qtyReceived: { increment: q } } });
    await tx.variant.update({ where: { id: l.variantId }, data: { cost: l.unitCost } });
  }
  if (!moves.length) throw new InventoryError("Enter at least one received quantity");
  await recordMovements(tx, moves);
  const lines = await tx.purchaseOrderLine.findMany({ where: { orderId: po.id } });
  const complete = lines.every((l) => l.qtyReceived >= l.qtyOrdered);
  await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: complete ? "received" : "partial" } });
  await writeAudit(tx, actor(ctx), "po.receive", "PurchaseOrder", po.id, { after: { received } });
  return complete;
}
