/**
 * Report aggregation as pure functions over sale rows, so totals can be
 * checked against hand-computed fixtures to the cent.
 */
import type { Minor } from "./money";
import type { TaxLine } from "./tax";

export interface ReportSaleLine {
  variantId: string;
  productName: string;
  categoryName?: string | null;
  qty: number;
  gross: Minor;
  discount: Minor;
  net: Minor;
  taxTotal: Minor;
  total: Minor;
  unitCost: Minor;
  taxes: TaxLine[];
}

export interface ReportSale {
  id: string;
  createdAt: Date | string;
  status: "completed" | "voided" | "open" | "held";
  memberName: string;
  locationName?: string;
  /** Refunds have negative totals and lines. */
  isRefund: boolean;
  total: Minor;
  lines: ReportSaleLine[];
  payments: { tender: string; amount: Minor }[];
}

export interface SalesSummary {
  saleCount: number;
  refundCount: number;
  itemsSold: number;
  gross: Minor;
  discounts: Minor;
  net: Minor;
  tax: Minor;
  total: Minor;
  refunds: Minor;
  cost: Minor;
  profit: Minor;
  /** Profit / net in basis points. */
  marginBp: number;
  averageSale: Minor;
}

export function counted(sales: readonly ReportSale[]): ReportSale[] {
  return sales.filter((s) => s.status === "completed");
}

export function summarizeSales(sales: readonly ReportSale[]): SalesSummary {
  const done = counted(sales);
  let gross = 0, discounts = 0, net = 0, tax = 0, total = 0, refunds = 0, cost = 0, items = 0;
  let saleCount = 0, refundCount = 0;
  for (const s of done) {
    if (s.isRefund) {
      refundCount++;
      refunds += s.total;
    } else saleCount++;
    total += s.total;
    for (const l of s.lines) {
      gross += l.gross;
      discounts += l.discount;
      net += l.net;
      tax += l.taxTotal;
      cost += l.unitCost * l.qty;
      items += l.qty;
    }
  }
  const profit = net - cost;
  return {
    saleCount,
    refundCount,
    itemsSold: items,
    gross,
    discounts,
    net,
    tax,
    total,
    refunds,
    cost,
    profit,
    marginBp: net === 0 ? 0 : Math.round((profit / net) * 10_000),
    averageSale: saleCount === 0 ? 0 : Math.round((total - refunds) / saleCount),
  };
}

function dayKey(d: Date | string, timeZone: string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function salesByDay(sales: readonly ReportSale[], timeZone = "UTC") {
  const map = new Map<string, { day: string; total: Minor; count: number }>();
  for (const s of counted(sales)) {
    const k = dayKey(s.createdAt, timeZone);
    const row = map.get(k) ?? { day: k, total: 0, count: 0 };
    row.total += s.total;
    if (!s.isRefund) row.count++;
    map.set(k, row);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function salesByHour(sales: readonly ReportSale[], timeZone = "UTC") {
  const rows = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0, count: 0 }));
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" });
  for (const s of counted(sales)) {
    const h = Number(fmt.format(typeof s.createdAt === "string" ? new Date(s.createdAt) : s.createdAt)) % 24;
    rows[h]!.total += s.total;
    if (!s.isRefund) rows[h]!.count++;
  }
  return rows;
}

export function salesByTender(sales: readonly ReportSale[]) {
  const map = new Map<string, Minor>();
  for (const s of counted(sales)) for (const p of s.payments) map.set(p.tender, (map.get(p.tender) ?? 0) + p.amount);
  return [...map.entries()].map(([tender, amount]) => ({ tender, amount })).sort((a, b) => b.amount - a.amount);
}

export function salesByStaff(sales: readonly ReportSale[]) {
  const map = new Map<string, { member: string; count: number; total: Minor; refunds: Minor }>();
  for (const s of counted(sales)) {
    const row = map.get(s.memberName) ?? { member: s.memberName, count: 0, total: 0, refunds: 0 };
    row.total += s.total;
    if (s.isRefund) row.refunds += s.total;
    else row.count++;
    map.set(s.memberName, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function salesByProduct(sales: readonly ReportSale[]) {
  const map = new Map<string, { variantId: string; name: string; category: string; qty: number; net: Minor; total: Minor; cost: Minor; profit: Minor }>();
  for (const s of counted(sales)) {
    for (const l of s.lines) {
      const row = map.get(l.variantId) ?? { variantId: l.variantId, name: l.productName, category: l.categoryName ?? "", qty: 0, net: 0, total: 0, cost: 0, profit: 0 };
      row.qty += l.qty;
      row.net += l.net;
      row.total += l.total;
      row.cost += l.unitCost * l.qty;
      row.profit = row.net - row.cost;
      map.set(l.variantId, row);
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function salesByCategory(sales: readonly ReportSale[]) {
  const map = new Map<string, { category: string; qty: number; net: Minor; total: Minor }>();
  for (const p of salesByProduct(sales)) {
    const k = p.category || "Uncategorized";
    const row = map.get(k) ?? { category: k, qty: 0, net: 0, total: 0 };
    row.qty += p.qty;
    row.net += p.net;
    row.total += p.total;
    map.set(k, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function taxReport(sales: readonly ReportSale[]) {
  const map = new Map<string, { ruleId: string; name: string; rateBp: number; inclusive: boolean; taxable: Minor; tax: Minor }>();
  for (const s of counted(sales)) {
    for (const l of s.lines) {
      for (const t of l.taxes) {
        const row = map.get(t.ruleId) ?? { ruleId: t.ruleId, name: t.name, rateBp: t.rateBp, inclusive: t.inclusive, taxable: 0, tax: 0 };
        row.taxable += l.net;
        row.tax += t.amount;
        map.set(t.ruleId, row);
      }
    }
  }
  return [...map.values()];
}

export interface InventoryRow {
  variantId: string;
  name: string;
  sku?: string | null;
  onHand: number;
  unitCost: Minor;
  price: Minor;
  reorderPoint?: number | null;
}

export function inventoryValuation(rows: readonly InventoryRow[]) {
  let units = 0, costValue = 0, retailValue = 0, low = 0;
  for (const r of rows) {
    const q = Math.max(0, r.onHand);
    units += q;
    costValue += q * r.unitCost;
    retailValue += q * r.price;
    if (r.reorderPoint != null && r.reorderPoint > 0 && r.onHand <= r.reorderPoint) low++;
  }
  return { skus: rows.length, units, costValue, retailValue, lowStockCount: low };
}

/** Percentage change in basis points between two periods. */
export function changeBp(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 10_000);
}
