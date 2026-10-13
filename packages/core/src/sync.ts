/**
 * Offline sync contract (ADR-007). The client writes operations to an outbox
 * in IndexedDB and posts them in batches to the idempotent `POST /api/v1/sync`.
 * Server is the source of truth for the catalog; the client for its own sales.
 */
import { z } from "zod";
import { computeCart, type CartInput } from "./cart";
import { TENDERS } from "./payments";

const minor = z.number().int().safe();
const uuid = z.string().uuid();

export const DiscountSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("percent"), valueBp: z.number().int().min(0).max(10_000) }),
  z.object({ type: z.literal("amount"), value: minor.min(0) }),
]);

export const TaxRuleSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  rateBp: z.number().int().min(0).max(100_000),
  inclusive: z.boolean(),
  compound: z.boolean(),
  priority: z.number().int().optional(),
});

export const SaleLinePayloadSchema = z.object({
  id: uuid,
  variantId: z.string().min(1),
  name: z.string().min(1).max(200),
  qty: z.number().int().refine((q) => q !== 0, "Quantity cannot be zero"),
  unitPrice: minor,
  catalogPrice: minor.optional(),
  unitCost: minor.optional(),
  modifiers: z.array(z.object({ name: z.string().max(100), priceDelta: minor })).max(30).default([]),
  discount: DiscountSchema.nullish(),
  taxRules: z.array(TaxRuleSnapshotSchema).max(10).default([]),
  note: z.string().max(200).optional(),
  course: z.number().int().min(0).max(9).optional(),
});

export const PaymentPayloadSchema = z.object({
  id: uuid,
  tender: z.enum(TENDERS),
  amount: minor,
  reference: z.string().max(100).nullish(),
});

export const SalePayloadSchema = z.object({
  clientId: uuid,
  number: z.string().min(1).max(40),
  locationId: z.string().min(1),
  shiftId: z.string().nullish(),
  memberId: z.string().min(1),
  customerId: z.string().nullish(),
  tableId: z.string().nullish(),
  covers: z.number().int().min(0).max(500).nullish(),
  quoteId: z.string().nullish(),
  createdAt: z.string().datetime(),
  lines: z.array(SaleLinePayloadSchema).min(1).max(500),
  orderDiscount: DiscountSchema.nullish(),
  payments: z.array(PaymentPayloadSchema).max(10),
  change: minor.min(0).default(0),
  expected: z.object({ total: minor, taxTotal: minor }),
  note: z.string().max(500).optional(),
});
export type SalePayload = z.infer<typeof SalePayloadSchema>;
export type SaleLinePayload = z.infer<typeof SaleLinePayloadSchema>;

export const CashMovementPayloadSchema = z.object({
  clientId: uuid,
  shiftId: z.string().min(1),
  type: z.enum(["in", "out"]),
  amount: minor.positive(),
  reason: z.string().max(200),
  createdAt: z.string().datetime(),
});
export type CashMovementPayload = z.infer<typeof CashMovementPayloadSchema>;

export const SyncOpSchema = z.discriminatedUnion("type", [
  z.object({ opId: uuid, type: z.literal("sale.create"), payload: SalePayloadSchema }),
  z.object({ opId: uuid, type: z.literal("cash.movement"), payload: CashMovementPayloadSchema }),
]);
export type SyncOp = z.infer<typeof SyncOpSchema>;

export const SyncBatchSchema = z.object({
  deviceId: z.string().min(1).max(100),
  ops: z.array(SyncOpSchema).min(1).max(100),
});
export type SyncBatch = z.infer<typeof SyncBatchSchema>;

export type SyncOpStatus = "applied" | "duplicate" | "rejected";
export interface SyncOpResult {
  opId: string;
  status: SyncOpStatus;
  error?: string;
  /** Non-fatal issues raised after sync, e.g. negative stock. */
  flags?: string[];
  serverId?: string;
}
export interface SyncResponse {
  results: SyncOpResult[];
  serverTime: string;
}

export function cartInputFromPayload(p: Pick<SalePayload, "lines" | "orderDiscount">): CartInput {
  return {
    lines: p.lines.map((l) => ({
      id: l.id,
      variantId: l.variantId,
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      modifiers: l.modifiers,
      discount: l.discount ?? null,
      taxRules: l.taxRules,
      unitCost: l.unitCost,
    })),
    orderDiscount: p.orderDiscount ?? null,
  };
}

/** Recompute a payload's totals and verify they match what the client recorded. */
export function verifySalePayload(p: SalePayload) {
  const totals = computeCart(cartInputFromPayload(p));
  const errors: string[] = [];
  if (totals.total !== p.expected.total) errors.push(`Total mismatch: client ${p.expected.total}, computed ${totals.total}`);
  if (totals.taxTotal !== p.expected.taxTotal) errors.push(`Tax mismatch: client ${p.expected.taxTotal}, computed ${totals.taxTotal}`);
  const paid = p.payments.reduce((a, x) => a + x.amount, 0);
  if (paid - p.change !== totals.total) errors.push(`Payments ${paid} minus change ${p.change} do not equal total ${totals.total}`);
  if (p.change > 0 && !p.payments.some((x) => x.tender === "cash")) errors.push("Change can only be given on cash");
  return { totals, errors };
}

/** Exponential backoff with jitter for retries: 1s, 2s, 4s … capped at 60s. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(60_000, 1000 * 2 ** Math.max(0, attempt));
  return Math.round(base / 2 + (random() * base) / 2);
}

/** Split an outbox into batches the endpoint accepts. */
export function chunk<T>(items: readonly T[], size = 50): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
