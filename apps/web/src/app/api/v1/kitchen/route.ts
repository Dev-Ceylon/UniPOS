import { withTenant } from "@unipos/db";
import { NextResponse } from "next/server";
import { apiContext, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Open kitchen tickets for the current location (polled by the KDS). */
export async function GET() {
  const ctx = await apiContext("restaurant.use");
  if (ctx instanceof NextResponse) return ctx;
  const since = new Date(Date.now() - 12 * 3600_000);
  const [open, recent] = await withTenant(ctx.tenantId, (tx) =>
    Promise.all([
      tx.kitchenTicket.findMany({ where: { locationId: ctx.locationId, status: { in: ["new", "in_progress", "ready"] } }, orderBy: { createdAt: "asc" } }),
      tx.kitchenTicket.findMany({ where: { locationId: ctx.locationId, status: "bumped", bumpedAt: { gte: since } }, orderBy: { bumpedAt: "desc" }, take: 5 }),
    ]),
  );
  return json({ open, recent, serverTime: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
