import "server-only";
import { buildReceipt, type ReceiptModel, type ReceiptTemplate, type TaxLine } from "@unipos/core";
import type { Tx } from "@unipos/db";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { AppContext } from "./context";

export async function receiptModel(ctx: AppContext, tx: Tx, saleId: string): Promise<ReceiptModel | null> {
  const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { lines: true, payments: true, customer: true } });
  if (!sale) return null;
  const location = await tx.location.findUnique({ where: { id: sale.locationId } });
  return buildReceipt(
    {
      number: sale.number,
      createdAt: sale.createdAt,
      businessName: ctx.tenant.name,
      locationName: location?.name ?? "",
      locationAddress: location?.address,
      receiptHeader: location?.receiptHeader,
      cashier: sale.memberName,
      customer: sale.customer?.deletedAt ? null : sale.customer?.name,
      table: sale.tableName,
      isRefund: sale.isRefund,
      lines: sale.lines.map((l) => ({
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        total: l.total,
        discount: l.lineDiscount + l.orderDiscount,
        modifiers: l.modifiers as { name: string; priceDelta: number }[],
      })),
      subtotal: sale.subtotal,
      discountTotal: sale.discountTotal,
      taxes: (sale.taxes as unknown as TaxLine[]).length
        ? (sale.taxes as unknown as TaxLine[])
        : summarize(sale.lines.map((l) => l.taxLines as unknown as TaxLine[])),
      taxTotal: sale.taxTotal,
      total: sale.total,
      payments: sale.payments.map((p) => ({ tender: p.tender, amount: p.amount })),
      change: sale.change,
      currency: ctx.currency,
      locale: ctx.locale,
      timeZone: ctx.timezone,
    },
    ctx.settings.receipt as ReceiptTemplate,
  );
}

function summarize(lines: TaxLine[][]): TaxLine[] {
  const m = new Map<string, TaxLine>();
  for (const ts of lines) for (const t of ts) m.set(t.ruleId, { ...t, amount: (m.get(t.ruleId)?.amount ?? 0) + t.amount });
  return [...m.values()];
}

/** Render a receipt as an 80 mm-wide PDF (WinAnsi-safe text). */
export async function receiptPdf(model: ReceiptModel, widthMm = 80): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Courier);
  const bold = await pdf.embedFont(StandardFonts.CourierBold);
  const mm = 72 / 25.4;
  const width = widthMm * mm;
  const size = 8;
  const lh = size * 1.35;
  const safe = (s: string) => s.replace(/[^\x20-\x7E]/g, (c) => ({ "×": "x", "−": "-", "–": "-", "—": "-", "“": '"', "”": '"' })[c] ?? "?");
  const rows: { text: string; right?: string; bold?: boolean; center?: boolean }[] = [];
  rows.push({ text: model.title, bold: true, center: true }, ...model.headerLines.map((t) => ({ text: t, center: true })), { text: "-" });
  for (const m of model.meta) rows.push({ text: m.label, right: m.value });
  rows.push({ text: "-" });
  for (const it of model.items) {
    rows.push({ text: it.name, right: it.amount }, { text: `  ${it.detail}` }, ...it.sub.map((s) => ({ text: `  ${s}` })));
  }
  rows.push({ text: "-" }, ...model.totals.map((t) => ({ text: t.label, right: t.value, bold: t.strong })), { text: "-" });
  rows.push(...model.payments.map((p) => ({ text: p.label, right: p.value })));
  if (model.footerLines.length) rows.push({ text: "-" }, ...model.footerLines.map((t) => ({ text: t, center: true })));
  const height = (rows.length + 4) * lh + 8 * mm;
  const page = pdf.addPage([width, height]);
  let y = height - 6 * mm;
  const margin = 4 * mm;
  for (const r of rows) {
    const f = r.bold ? bold : font;
    if (r.text === "-") {
      page.drawLine({ start: { x: margin, y: y + lh / 3 }, end: { x: width - margin, y: y + lh / 3 }, thickness: 0.4, dashArray: [2, 2] });
    } else if (r.center) {
      const t = safe(r.text);
      page.drawText(t, { x: Math.max(margin, (width - f.widthOfTextAtSize(t, size)) / 2), y, size, font: f });
    } else {
      page.drawText(safe(r.text).slice(0, 40), { x: margin, y, size, font: f });
      if (r.right) {
        const t = safe(r.right);
        page.drawText(t, { x: width - margin - f.widthOfTextAtSize(t, size), y, size, font: f });
      }
    }
    y -= lh;
  }
  return pdf.save();
}
