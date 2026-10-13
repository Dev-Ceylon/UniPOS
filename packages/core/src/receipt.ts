/** Receipt model shared by the 80 mm print layout, PDF and email. */
import { formatMoney, type Minor } from "./money";
import type { TaxLine } from "./tax";

export interface ReceiptTemplate {
  header: string;
  footer: string;
  showTaxBreakdown: boolean;
  showCashier: boolean;
  showBarcode: boolean;
  showCustomer: boolean;
  showTable: boolean;
  logoText: string;
  paperWidthMm: 58 | 80;
}

export const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplate = {
  header: "",
  footer: "Thank you!",
  showTaxBreakdown: true,
  showCashier: true,
  showBarcode: true,
  showCustomer: true,
  showTable: false,
  logoText: "",
  paperWidthMm: 80,
};

export interface ReceiptSaleInput {
  number: string;
  createdAt: Date | string;
  businessName: string;
  locationName: string;
  locationAddress?: string | null;
  receiptHeader?: string | null;
  cashier?: string | null;
  customer?: string | null;
  table?: string | null;
  isRefund?: boolean;
  lines: { name: string; qty: number; unitPrice: Minor; total: Minor; discount: Minor; modifiers?: { name: string; priceDelta: Minor }[] }[];
  subtotal: Minor;
  discountTotal: Minor;
  taxes: TaxLine[];
  taxTotal: Minor;
  total: Minor;
  payments: { tender: string; amount: Minor }[];
  change: Minor;
  currency: string;
  locale?: string;
  timeZone?: string;
}

export interface ReceiptModel {
  title: string;
  headerLines: string[];
  meta: { label: string; value: string }[];
  items: { name: string; detail: string; amount: string; sub: string[] }[];
  totals: { label: string; value: string; strong?: boolean }[];
  payments: { label: string; value: string }[];
  footerLines: string[];
  barcode?: string;
}

const TENDER_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  wallet: "Wallet",
  gift_card: "Gift card",
  points: "Points",
  other: "Other",
};

export function buildReceipt(sale: ReceiptSaleInput, tpl: ReceiptTemplate = DEFAULT_RECEIPT_TEMPLATE): ReceiptModel {
  const m = (v: Minor) => formatMoney(v, sale.currency, sale.locale ?? "en");
  const when = new Intl.DateTimeFormat(sale.locale ?? "en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: sale.timeZone ?? "UTC",
  }).format(typeof sale.createdAt === "string" ? new Date(sale.createdAt) : sale.createdAt);
  const split = (s?: string | null) => (s ? s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) : []);
  const meta = [
    { label: sale.isRefund ? "Refund" : "Receipt", value: sale.number },
    { label: "Date", value: when },
  ];
  if (tpl.showCashier && sale.cashier) meta.push({ label: "Cashier", value: sale.cashier });
  if (tpl.showCustomer && sale.customer) meta.push({ label: "Customer", value: sale.customer });
  if (tpl.showTable && sale.table) meta.push({ label: "Table", value: sale.table });
  const totals: ReceiptModel["totals"] = [{ label: "Subtotal", value: m(sale.subtotal) }];
  if (sale.discountTotal) totals.push({ label: "Discount", value: m(-sale.discountTotal) });
  if (tpl.showTaxBreakdown) {
    for (const t of sale.taxes) totals.push({ label: `${t.name} ${(t.rateBp / 100).toFixed(2).replace(/\.00$/, "")}%${t.inclusive ? " (incl.)" : ""}`, value: m(t.amount) });
  } else if (sale.taxTotal) totals.push({ label: "Tax", value: m(sale.taxTotal) });
  totals.push({ label: "Total", value: m(sale.total), strong: true });
  const payments = sale.payments.map((p) => ({ label: TENDER_LABELS[p.tender] ?? p.tender, value: m(p.amount) }));
  if (sale.change) payments.push({ label: "Change", value: m(sale.change) });
  return {
    title: tpl.logoText || sale.businessName,
    headerLines: [sale.locationName, ...split(sale.locationAddress), ...split(sale.receiptHeader), ...split(tpl.header)],
    meta,
    items: sale.lines.map((l) => ({
      name: l.name,
      detail: `${l.qty} × ${m(l.unitPrice)}`,
      amount: m(l.total),
      sub: [
        ...(l.modifiers ?? []).map((x) => `+ ${x.name}${x.priceDelta ? ` ${m(x.priceDelta)}` : ""}`),
        ...(l.discount ? [`Discount ${m(-l.discount)}`] : []),
      ],
    })),
    totals,
    payments,
    footerLines: split(tpl.footer),
    barcode: tpl.showBarcode ? sale.number : undefined,
  };
}

/** Plain-text rendering (email body, ESC/POS bridge later). */
export function receiptToText(r: ReceiptModel, width = 42): string {
  const center = (s: string) => " ".repeat(Math.max(0, Math.floor((width - s.length) / 2))) + s;
  const row = (a: string, b: string) => {
    const space = width - a.length - b.length;
    return space >= 1 ? a + " ".repeat(space) + b : `${a}\n${" ".repeat(Math.max(0, width - b.length))}${b}`;
  };
  const rule = "-".repeat(width);
  const out = [center(r.title), ...r.headerLines.map(center), rule, ...r.meta.map((x) => row(x.label, x.value)), rule];
  for (const it of r.items) {
    out.push(row(it.name, it.amount), `  ${it.detail}`, ...it.sub.map((s) => `  ${s}`));
  }
  out.push(rule, ...r.totals.map((t) => row(t.label, t.value)), rule, ...r.payments.map((p) => row(p.label, p.value)));
  if (r.footerLines.length) out.push(rule, ...r.footerLines.map(center));
  return out.join("\n");
}
