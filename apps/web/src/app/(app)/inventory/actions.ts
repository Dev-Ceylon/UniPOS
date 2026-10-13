"use server";
import { STOCK_REASONS, type StockReason } from "@unipos/core";
import {
  adjustStock,
  cancelTransfer,
  completeStocktake,
  createTransfer,
  receiveTransfer,
  recordCounts,
  sendTransfer,
  setReorderPoint,
  startStocktake,
} from "@unipos/db";
import { z } from "zod";
import { action } from "@/lib/actions";

export async function adjustAction(input: { variantId: string; mode: "delta" | "set"; qty: number; reason: string; note?: string }) {
  return action("inventory.adjust", async (ctx, tx) => {
    const d = z
      .object({
        variantId: z.string(),
        mode: z.enum(["delta", "set"]),
        qty: z.number().int(),
        reason: z.enum(STOCK_REASONS),
        note: z.string().max(200).optional(),
      })
      .parse(input);
    return adjustStock(tx, ctx, { ...d, reason: d.reason as StockReason, locationId: ctx.locationId });
  });
}

export async function reorderAction(variantId: string, value: number | null) {
  return action("inventory.adjust", async (ctx, tx) => {
    await setReorderPoint(tx, ctx, variantId, ctx.locationId, value);
    return true;
  });
}

export async function startStocktakeAction(categoryId: string | null, note: string) {
  return action("inventory.stocktake", async (ctx, tx) => (await startStocktake(tx, ctx, ctx.locationId, categoryId, note || undefined)).id);
}

export async function saveCountsAction(stocktakeId: string, counts: { variantId: string; counted: number | null }[]) {
  return action("inventory.stocktake", async (ctx, tx) => {
    await recordCounts(tx, ctx, stocktakeId, counts);
    return true;
  });
}

export async function completeStocktakeAction(stocktakeId: string, counts: { variantId: string; counted: number | null }[]) {
  return action("inventory.stocktake", async (ctx, tx) => {
    await recordCounts(tx, ctx, stocktakeId, counts);
    return (await completeStocktake(tx, ctx, stocktakeId)).length;
  });
}

export async function cancelStocktakeAction(stocktakeId: string) {
  return action("inventory.stocktake", async (_ctx, tx) => {
    await tx.stocktake.update({ where: { id: stocktakeId }, data: { status: "cancelled" } });
    return true;
  });
}

export async function createTransferAction(toLocationId: string, lines: { variantId: string; qty: number }[], note: string) {
  return action(
    "inventory.transfer",
    async (ctx, tx) => (await createTransfer(tx, ctx, { fromLocationId: ctx.locationId, toLocationId, lines, note: note || undefined })).id,
    { module: "multilocation" },
  );
}

export async function transferStep(id: string, step: "send" | "receive" | "cancel", received?: Record<string, number>) {
  return action(
    "inventory.transfer",
    async (ctx, tx) => {
      if (step === "send") await sendTransfer(tx, ctx, id);
      else if (step === "receive") await receiveTransfer(tx, ctx, id, received);
      else await cancelTransfer(tx, ctx, id);
      return true;
    },
    { module: "multilocation" },
  );
}
