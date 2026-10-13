import { exportCustomerData, withTenant } from "@unipos/db";
import { NextResponse } from "next/server";
import { apiContext } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Personal-data export (access request) as JSON. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await apiContext("customers.privacy");
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const data = await withTenant(ctx.tenantId, (tx) => exportCustomerData(tx, ctx, id));
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="customer-${id}.json"` },
  });
}
