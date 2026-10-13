import { NextResponse } from "next/server";
import { apiContext, json } from "@/lib/api";
import { buildReport, parseRange, REPORT_TYPES, reportCsv, reportPdf, type ReportType } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await apiContext("reports.export");
  if (ctx instanceof NextResponse) return ctx;
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const type = sp.type as ReportType;
  if (!REPORT_TYPES.includes(type)) return json({ error: "unknown report" }, { status: 400 });
  const range = parseRange(ctx, sp);
  const table = await buildReport(ctx, type, range);
  const name = `${type}-${range.from}-to-${range.to}`;
  if (sp.format === "pdf") {
    const bytes = await reportPdf(ctx, table, range);
    return new Response(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${name}.pdf"` } });
  }
  return new Response(`﻿${reportCsv(ctx, table)}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` } });
}
