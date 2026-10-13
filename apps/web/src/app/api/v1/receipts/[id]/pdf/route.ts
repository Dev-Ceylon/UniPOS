import { withTenant } from "@unipos/db";
import { NextResponse } from "next/server";
import { apiContext, json } from "@/lib/api";
import { receiptModel, receiptPdf } from "@/lib/receipts";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await apiContext("sales.view");
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const model = await withTenant(ctx.tenantId, (tx) => receiptModel(ctx, tx, id));
  if (!model) return json({ error: "not found" }, { status: 404 });
  const bytes = await receiptPdf(model, ctx.settings.receipt.paperWidthMm);
  return new Response(Buffer.from(bytes), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="receipt-${model.meta[0]?.value ?? id}.pdf"` },
  });
}
