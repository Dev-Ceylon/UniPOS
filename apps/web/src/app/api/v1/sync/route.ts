import { SyncBatchSchema } from "@unipos/core";
import { applySyncBatch } from "@unipos/db";
import { NextResponse } from "next/server";
import { apiContext, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Idempotent sync endpoint (ADR-007). Each op is applied once; replays return
 * "duplicate". Batches are capped at 100 ops and rate-limited per device.
 */
export async function POST(req: Request) {
  const ctx = await apiContext("register.use");
  if (ctx instanceof NextResponse) return ctx;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, { status: 400 });
  }
  // Validate the envelope only; ops are validated one by one so a bad op is
  // rejected individually instead of failing the whole batch.
  const envelope = SyncBatchSchema.pick({ deviceId: true }).safeParse(body);
  const ops = (body as { ops?: unknown })?.ops;
  if (!envelope.success || !Array.isArray(ops) || ops.length === 0 || ops.length > 100) {
    return json({ error: "invalid batch" }, { status: 400 });
  }
  if (!rateLimit(`sync:${ctx.tenantId}:${envelope.data.deviceId}`, 30, 1)) return json({ error: "rate limited" }, { status: 429 });
  const results = await applySyncBatch(ctx, envelope.data.deviceId, ops as never);
  return json({ results, serverTime: new Date().toISOString() });
}
