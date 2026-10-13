/**
 * Cart totals: line amounts, line and order discounts, taxes. Pure and shared
 * by the register (offline) and the server (which recomputes on sync).
 */
import { allocate, applyBasisPoints, assertMinor, type Minor } from "./money";
import { calculateLineTax, summarizeTaxes, type TaxLine, type TaxRule } from "./tax";

export type Discount = { type: "percent"; valueBp: number } | { type: "amount"; value: Minor };

export interface CartModifier {
  name: string;
  priceDelta: Minor;
}

export interface CartLineInput {
  id: string;
  variantId: string;
  name: string;
  qty: number;
  unitPrice: Minor;
  modifiers?: CartModifier[];
  discount?: Discount | null;
  taxRules: TaxRule[];
  /** Cost per unit for profit reports; never shown to the customer. */
  unitCost?: Minor;
}

export interface CartInput {
  lines: CartLineInput[];
  orderDiscount?: Discount | null;
}

export interface CartLineResult {
  id: string;
  variantId: string;
  name: string;
  qty: number;
  unitPrice: Minor;
  modifiers: CartModifier[];
  /** (unitPrice + modifiers) × qty */
  gross: Minor;
  lineDiscount: Minor;
  orderDiscount: Minor;
  /** gross − discounts (shelf price basis, includes inclusive tax) */
  amount: Minor;
  net: Minor;
  taxes: TaxLine[];
  taxTotal: Minor;
  total: Minor;
  unitCost: Minor;
}

export interface CartTotals {
  lines: CartLineResult[];
  subtotal: Minor;
  discountTotal: Minor;
  /** Sum of net amounts (excluding all taxes). */
  netTotal: Minor;
  taxTotal: Minor;
  inclusiveTaxTotal: Minor;
  exclusiveTaxTotal: Minor;
  taxes: TaxLine[];
  total: Minor;
  itemCount: number;
}

function discountAmount(base: Minor, d: Discount | null | undefined): Minor {
  if (!d) return 0;
  const sign = base < 0 ? -1 : 1;
  const absBase = Math.abs(base);
  let amt: number;
  if (d.type === "percent") {
    if (d.valueBp < 0 || d.valueBp > 10_000) throw new RangeError("Percent discount must be 0–100%");
    amt = applyBasisPoints(absBase, d.valueBp);
  } else {
    assertMinor(d.value, "discount");
    if (d.value < 0) throw new RangeError("Discount cannot be negative");
    amt = Math.min(d.value, absBase);
  }
  return amt === 0 ? 0 : amt * sign;
}

export function lineGross(line: Pick<CartLineInput, "qty" | "unitPrice" | "modifiers">): Minor {
  if (!Number.isInteger(line.qty)) throw new RangeError("Quantity must be a whole number");
  assertMinor(line.unitPrice, "unitPrice");
  const unit = line.unitPrice + (line.modifiers ?? []).reduce((a, m) => a + m.priceDelta, 0);
  return unit * line.qty;
}

export function computeCart(input: CartInput): CartTotals {
  const gross = input.lines.map(lineGross);
  const lineDisc = input.lines.map((l, i) => discountAmount(gross[i]!, l.discount));
  const afterLine = gross.map((g, i) => g - lineDisc[i]!);
  const afterLineTotal = afterLine.reduce((a, b) => a + b, 0);
  const orderDiscTotal = discountAmount(afterLineTotal, input.orderDiscount);
  const orderDisc = allocate(orderDiscTotal, afterLine);

  const lines: CartLineResult[] = input.lines.map((l, i) => {
    const amount = afterLine[i]! - (orderDisc[i] ?? 0);
    const tax = calculateLineTax(amount, l.taxRules);
    return {
      id: l.id,
      variantId: l.variantId,
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      modifiers: l.modifiers ?? [],
      gross: gross[i]!,
      lineDiscount: lineDisc[i]!,
      orderDiscount: orderDisc[i] ?? 0,
      amount,
      net: tax.net,
      taxes: tax.taxes,
      taxTotal: tax.inclusiveTax + tax.exclusiveTax,
      total: tax.total,
      unitCost: l.unitCost ?? 0,
    };
  });

  const sum = (f: (l: CartLineResult) => number) => lines.reduce((a, l) => a + f(l), 0);
  const taxes = summarizeTaxes(lines.map((l) => l.taxes));
  const lineTaxes = lines.flatMap((l) => l.taxes);
  const inclusiveTaxTotal = lineTaxes.filter((t) => t.inclusive).reduce((a, t) => a + t.amount, 0);
  const exclusiveTaxTotal = lineTaxes.filter((t) => !t.inclusive).reduce((a, t) => a + t.amount, 0);
  return {
    lines,
    subtotal: sum((l) => l.gross),
    discountTotal: sum((l) => l.lineDiscount + l.orderDiscount),
    netTotal: sum((l) => l.net),
    taxTotal: inclusiveTaxTotal + exclusiveTaxTotal,
    inclusiveTaxTotal,
    exclusiveTaxTotal,
    taxes,
    total: sum((l) => l.total),
    itemCount: sum((l) => l.qty),
  };
}

/** Discount as a fraction of the gross in basis points (for threshold checks). */
export function discountRatioBp(totals: Pick<CartTotals, "subtotal" | "discountTotal">): number {
  if (totals.subtotal === 0) return 0;
  return Math.round((Math.abs(totals.discountTotal) / Math.abs(totals.subtotal)) * 10_000);
}
