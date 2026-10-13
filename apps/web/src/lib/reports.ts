import "server-only";
import {
  inventoryValuation, salesByCategory, salesByDay, salesByProduct, salesByStaff, salesByTender, summarizeSales, taxReport, toCsv, toDecimalString,
} from "@unipos/core";
import { loadReportSales, withTenant } from "@unipos/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AppContext } from "./context";
import { money, ymd, zonedToUtc } from "./format";

export const REPORT_TYPES = ["sales", "products", "categories", "staff", "tax", "tenders", "inventory"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportRange {
  from: string; // YYYY-MM-DD in shop time
  to: string;
  locationId: string | null;
}

export interface ReportTable {
  title: string;
  columns: { key: string; label: string; money?: boolean; align?: "right" }[];
  rows: Record<string, string | number>[];
  totals?: Record<string, string | number>;
}

export function parseRange(ctx: AppContext, sp: { from?: string; to?: string; location?: string }): ReportRange {
  const today = ymd(new Date(), ctx.timezone);
  const ok = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  return {
    from: ok(sp.from) ?? `${today.slice(0, 8)}01`,
    to: ok(sp.to) ?? today,
    locationId: sp.location === "all" ? null : (sp.location ?? ctx.locationId),
  };
}

export async function loadSales(ctx: AppContext, r: ReportRange) {
  const from = zonedToUtc(`${r.from}T00:00:00`, ctx.timezone);
  const to = new Date(zonedToUtc(`${r.to}T00:00:00`, ctx.timezone).getTime() + 86400_000);
  return withTenant(ctx.tenantId, (tx) => loadReportSales(tx, { from, to, locationId: r.locationId }));
}

export async function buildReport(ctx: AppContext, type: ReportType, r: ReportRange): Promise<ReportTable> {
  const m = (v: number) => money(v, ctx.currency, ctx.locale);
  if (type === "inventory") {
    const rows = await withTenant(ctx.tenantId, (tx) =>
      tx.variant.findMany({
        where: { deletedAt: null, product: { deletedAt: null, trackStock: true } },
        include: { product: true, stockLevels: r.locationId ? { where: { locationId: r.locationId } } : true },
        orderBy: { product: { name: "asc" } },
      }),
    );
    const items = rows.map((v) => ({ variantId: v.id, name: v.name ? `${v.product.name} — ${v.name}` : v.product.name, sku: v.sku, onHand: v.stockLevels.reduce((a, s) => a + s.onHand, 0), unitCost: v.cost, price: v.price, reorderPoint: v.stockLevels[0]?.reorderPoint }));
    const val = inventoryValuation(items);
    return {
      title: "Inventory valuation",
      columns: [
        { key: "name", label: "Product" },
        { key: "sku", label: "SKU" },
        { key: "onHand", label: "On hand", align: "right" },
        { key: "cost", label: "Unit cost", money: true, align: "right" },
        { key: "costValue", label: "Value at cost", money: true, align: "right" },
        { key: "retailValue", label: "Retail value", money: true, align: "right" },
      ],
      rows: items.map((i) => ({ name: i.name, sku: i.sku ?? "", onHand: i.onHand, cost: i.unitCost, costValue: Math.max(0, i.onHand) * i.unitCost, retailValue: Math.max(0, i.onHand) * i.price })),
      totals: { name: "Total", onHand: val.units, costValue: val.costValue, retailValue: val.retailValue },
    };
  }
  const sales = await loadSales(ctx, r);
  switch (type) {
    case "sales": {
      const s = summarizeSales(sales);
      return {
        title: "Sales by day",
        columns: [
          { key: "day", label: "Day" },
          { key: "count", label: "Sales", align: "right" },
          { key: "total", label: "Total", money: true, align: "right" },
        ],
        rows: salesByDay(sales, ctx.timezone),
        totals: { day: `Total (${m(s.gross)} gross, ${m(s.discounts)} discounts, ${m(s.tax)} tax, ${m(s.refunds)} refunds)`, count: s.saleCount, total: s.total },
      };
    }
    case "products": {
      const rows = salesByProduct(sales);
      return {
        title: "Sales and profit by product",
        columns: [
          { key: "name", label: "Product" },
          { key: "category", label: "Category" },
          { key: "qty", label: "Qty", align: "right" },
          { key: "net", label: "Net sales", money: true, align: "right" },
          { key: "cost", label: "Cost", money: true, align: "right" },
          { key: "profit", label: "Profit", money: true, align: "right" },
          { key: "total", label: "Total incl. tax", money: true, align: "right" },
        ],
        rows,
        totals: { name: "Total", qty: rows.reduce((a, x) => a + x.qty, 0), net: rows.reduce((a, x) => a + x.net, 0), cost: rows.reduce((a, x) => a + x.cost, 0), profit: rows.reduce((a, x) => a + x.profit, 0), total: rows.reduce((a, x) => a + x.total, 0) },
      };
    }
    case "categories": {
      const rows = salesByCategory(sales);
      return {
        title: "Sales by category",
        columns: [
          { key: "category", label: "Category" },
          { key: "qty", label: "Qty", align: "right" },
          { key: "net", label: "Net", money: true, align: "right" },
          { key: "total", label: "Total", money: true, align: "right" },
        ],
        rows,
        totals: { category: "Total", qty: rows.reduce((a, x) => a + x.qty, 0), net: rows.reduce((a, x) => a + x.net, 0), total: rows.reduce((a, x) => a + x.total, 0) },
      };
    }
    case "staff": {
      const rows = salesByStaff(sales);
      return {
        title: "Sales by staff",
        columns: [
          { key: "member", label: "Staff" },
          { key: "count", label: "Sales", align: "right" },
          { key: "refunds", label: "Refunds", money: true, align: "right" },
          { key: "total", label: "Net total", money: true, align: "right" },
        ],
        rows,
        totals: { member: "Total", count: rows.reduce((a, x) => a + x.count, 0), refunds: rows.reduce((a, x) => a + x.refunds, 0), total: rows.reduce((a, x) => a + x.total, 0) },
      };
    }
    case "tax": {
      const rows = taxReport(sales).map((t) => ({ name: t.name, taxable: t.taxable, tax: t.tax, rate: `${t.rateBp / 100}%`, type: t.inclusive ? "Inclusive" : "Exclusive" }));
      return {
        title: "Tax collected",
        columns: [
          { key: "name", label: "Tax" },
          { key: "rate", label: "Rate", align: "right" },
          { key: "type", label: "Type" },
          { key: "taxable", label: "Taxable (net)", money: true, align: "right" },
          { key: "tax", label: "Tax", money: true, align: "right" },
        ],
        rows,
        totals: { name: "Total", taxable: rows.reduce((a, x) => a + x.taxable, 0), tax: rows.reduce((a, x) => a + x.tax, 0) },
      };
    }
    case "tenders": {
      const rows = salesByTender(sales).map((t) => ({ ...t, tender: t.tender.replace("_", " ") }));
      return {
        title: "Payments by tender",
        columns: [
          { key: "tender", label: "Tender" },
          { key: "amount", label: "Amount", money: true, align: "right" },
        ],
        rows,
        totals: { tender: "Total", amount: rows.reduce((a, x) => a + x.amount, 0) },
      };
    }
  }
}

export function reportCsv(ctx: AppContext, t: ReportTable): string {
  const fmt = (row: Record<string, string | number>) =>
    Object.fromEntries(t.columns.map((c) => [c.label, c.money && typeof row[c.key] === "number" ? toDecimalString(row[c.key] as number, ctx.currency) : (row[c.key] ?? "")]));
  return toCsv([...t.rows.map(fmt), ...(t.totals ? [fmt(t.totals)] : [])], t.columns.map((c) => c.label));
}

export async function reportPdf(ctx: AppContext, t: ReportTable, r: ReportRange): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe = (s: string) => s.replace(/[^\x20-\x7E]/g, (c) => ({ "—": "-", "–": "-", "×": "x" })[c] ?? "?");
  const W = 842, H = 595, M = 36; // A4 landscape
  const colW = (W - 2 * M) / t.columns.length;
  const cell = (row: Record<string, string | number>, c: ReportTable["columns"][number]) => {
    const v = row[c.key];
    if (v === undefined || v === "") return "";
    return safe(c.money && typeof v === "number" ? money(v, ctx.currency, "en") : String(v));
  };
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const header = () => {
    page.drawText(safe(`${ctx.tenant.name} - ${t.title}`), { x: M, y, size: 14, font: bold });
    y -= 16;
    const loc = r.locationId ? (ctx.locations.find((l) => l.id === r.locationId)?.name ?? "") : "All locations";
    page.drawText(safe(`${r.from} to ${r.to} - ${loc} - generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`), { x: M, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
    y -= 20;
    t.columns.forEach((c, i) => {
      const x = c.align === "right" ? M + (i + 1) * colW - bold.widthOfTextAtSize(safe(c.label), 9) - 4 : M + i * colW;
      page.drawText(safe(c.label), { x, y, size: 9, font: bold });
    });
    y -= 4;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5 });
    y -= 12;
  };
  header();
  const drawRow = (row: Record<string, string | number>, f = font) => {
    if (y < M + 20) {
      page = pdf.addPage([W, H]);
      y = H - M;
      header();
    }
    t.columns.forEach((c, i) => {
      let text = cell(row, c);
      while (text.length > 1 && f.widthOfTextAtSize(text, 8.5) > colW - 6) text = text.slice(0, -2) + "…".replace("…", ".");
      const x = c.align === "right" ? M + (i + 1) * colW - f.widthOfTextAtSize(text, 8.5) - 4 : M + i * colW;
      page.drawText(text, { x, y, size: 8.5, font: f });
    });
    y -= 12;
  };
  t.rows.forEach((row) => drawRow(row));
  if (t.totals) {
    page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.5 });
    drawRow(t.totals, bold);
  }
  return pdf.save();
}
