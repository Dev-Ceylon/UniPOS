import { exportProductsCsv, withTenant } from "@unipos/db";
import { NextResponse } from "next/server";
import { apiContext } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiContext("products.import");
  if (ctx instanceof NextResponse) return ctx;
  const csv = await withTenant(ctx.tenantId, (tx) => exportProductsCsv(tx, ctx, ctx.locationId));
  return new Response(`﻿${csv}`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
