import type { StockReason } from "@unipos/core";
import type { Tx } from "../client";

export interface MovementInput {
  variantId: string;
  locationId: string;
  qtyChange: number;
  reason: StockReason;
  refType?: string;
  refId?: string;
  note?: string;
  memberId?: string | null;
}

/**
 * Append movements to the ledger and update the cached StockLevel in the same
 * transaction. Returns the new on-hand per variant:location.
 */
export async function recordMovements(tx: Tx, movements: readonly MovementInput[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const nonZero = movements.filter((m) => m.qtyChange !== 0);
  if (nonZero.length === 0) return result;
  await tx.stockMovement.createMany({
    data: nonZero.map((m) => ({
      variantId: m.variantId,
      locationId: m.locationId,
      qtyChange: m.qtyChange,
      reason: m.reason,
      refType: m.refType,
      refId: m.refId,
      note: m.note,
      memberId: m.memberId ?? null,
    })),
  });
  // aggregate per key so each level row is touched once
  const agg = new Map<string, MovementInput & { qty: number }>();
  for (const m of nonZero) {
    const k = `${m.variantId}:${m.locationId}`;
    const prev = agg.get(k);
    if (prev) prev.qty += m.qtyChange;
    else agg.set(k, { ...m, qty: m.qtyChange });
  }
  for (const [k, m] of agg) {
    const rows = await tx.$queryRaw<{ onHand: number }[]>`
      INSERT INTO "StockLevel" ("id", "tenantId", "variantId", "locationId", "onHand", "updatedAt")
      VALUES (gen_random_uuid()::text, unipos_current_tenant(), ${m.variantId}, ${m.locationId}, ${m.qty}, now())
      ON CONFLICT ("variantId", "locationId") DO UPDATE SET "onHand" = "StockLevel"."onHand" + EXCLUDED."onHand", "updatedAt" = now()
      RETURNING "onHand"`;
    result.set(k, Number(rows[0]!.onHand));
  }
  return result;
}

/** Recompute cached levels from the ledger (repair tool and test oracle). */
export async function rebuildStockLevels(tx: Tx): Promise<number> {
  const n = await tx.$executeRaw`
    UPDATE "StockLevel" sl SET "onHand" = COALESCE(s.total, 0), "updatedAt" = now()
    FROM (
      SELECT l."id", (SELECT SUM(m."qtyChange") FROM "StockMovement" m WHERE m."variantId" = l."variantId" AND m."locationId" = l."locationId") AS total
      FROM "StockLevel" l
    ) s WHERE s."id" = sl."id" AND sl."onHand" <> COALESCE(s.total, 0)`;
  return n;
}
