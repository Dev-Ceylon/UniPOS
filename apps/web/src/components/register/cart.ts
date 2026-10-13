"use client";
import { computeCart, uuidv7, type CartTotals, type Discount, type TaxRule } from "@unipos/core";
import { useEffect, useMemo, useReducer } from "react";

export interface CartLine {
  id: string;
  variantId: string;
  name: string;
  qty: number;
  unitPrice: number;
  catalogPrice: number;
  unitCost: number;
  modifiers: { name: string; priceDelta: number }[];
  discount: Discount | null;
  taxRules: TaxRule[];
  note?: string;
  course?: number;
  /** Quantity already sent to the kitchen (restaurant mode). */
  sentQty?: number;
}

export interface CartState {
  lines: CartLine[];
  orderDiscount: Discount | null;
  customerId: string | null;
  customerName: string | null;
  tableId: string | null;
  tableName: string | null;
  covers: number | null;
  quoteId: string | null;
  note: string;
  selectedId: string | null;
}

export const emptyCart = (): CartState => ({
  lines: [],
  orderDiscount: null,
  customerId: null,
  customerName: null,
  tableId: null,
  tableName: null,
  covers: null,
  quoteId: null,
  note: "",
  selectedId: null,
});

export type CartAction =
  | { type: "add"; line: Omit<CartLine, "id" | "qty"> & { qty?: number } }
  | { type: "qty"; id: string; qty: number }
  | { type: "inc"; id: string; by: number }
  | { type: "remove"; id: string }
  | { type: "select"; id: string | null }
  | { type: "price"; id: string; unitPrice: number }
  | { type: "lineDiscount"; id: string; discount: Discount | null }
  | { type: "lineNote"; id: string; note: string }
  | { type: "orderDiscount"; discount: Discount | null }
  | { type: "customer"; id: string | null; name: string | null }
  | { type: "table"; id: string | null; name: string | null; covers?: number | null; lines?: CartLine[] }
  | { type: "markSent" }
  | { type: "load"; state: CartState }
  | { type: "clear" };

const sameLine = (a: Omit<CartLine, "id" | "qty">, b: CartLine) =>
  a.variantId === b.variantId &&
  a.unitPrice === b.unitPrice &&
  !b.discount &&
  !b.note &&
  JSON.stringify(a.modifiers) === JSON.stringify(b.modifiers) &&
  !(b.sentQty && b.sentQty >= b.qty);

export function cartReducer(state: CartState, a: CartAction): CartState {
  switch (a.type) {
    case "add": {
      const existing = state.lines.find((l) => sameLine(a.line, l));
      if (existing) {
        return { ...state, selectedId: existing.id, lines: state.lines.map((l) => (l === existing ? { ...l, qty: l.qty + (a.line.qty ?? 1) } : l)) };
      }
      const line: CartLine = { ...a.line, id: uuidv7(), qty: a.line.qty ?? 1 };
      return { ...state, selectedId: line.id, lines: [...state.lines, line] };
    }
    case "qty":
      if (a.qty <= 0) return cartReducer(state, { type: "remove", id: a.id });
      return { ...state, lines: state.lines.map((l) => (l.id === a.id ? { ...l, qty: Math.max(a.qty, l.sentQty ?? 0) } : l)) };
    case "inc": {
      const l = state.lines.find((x) => x.id === a.id);
      return l ? cartReducer(state, { type: "qty", id: a.id, qty: l.qty + a.by }) : state;
    }
    case "remove": {
      const l = state.lines.find((x) => x.id === a.id);
      if (l?.sentQty) return { ...state, lines: state.lines.map((x) => (x.id === a.id ? { ...x, qty: x.sentQty! } : x)) };
      const lines = state.lines.filter((x) => x.id !== a.id);
      return { ...state, lines, selectedId: lines.at(-1)?.id ?? null };
    }
    case "select":
      return { ...state, selectedId: a.id };
    case "price":
      return { ...state, lines: state.lines.map((l) => (l.id === a.id ? { ...l, unitPrice: a.unitPrice } : l)) };
    case "lineDiscount":
      return { ...state, lines: state.lines.map((l) => (l.id === a.id ? { ...l, discount: a.discount } : l)) };
    case "lineNote":
      return { ...state, lines: state.lines.map((l) => (l.id === a.id ? { ...l, note: a.note || undefined } : l)) };
    case "orderDiscount":
      return { ...state, orderDiscount: a.discount };
    case "customer":
      return { ...state, customerId: a.id, customerName: a.name };
    case "table":
      return { ...emptyCart(), customerId: state.customerId, customerName: state.customerName, tableId: a.id, tableName: a.name, covers: a.covers ?? null, lines: a.lines ?? [] };
    case "markSent":
      return { ...state, lines: state.lines.map((l) => ({ ...l, sentQty: l.qty })) };
    case "load":
      return a.state;
    case "clear":
      return emptyCart();
  }
}

export function useCart(storageKey: string) {
  const [state, dispatch] = useReducer(cartReducer, undefined, emptyCart);
  // Restore the in-progress cart after a reload or crash.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) dispatch({ type: "load", state: { ...emptyCart(), ...JSON.parse(raw) } });
    } catch {
      /* ignore */
    }
  }, [storageKey]);
  useEffect(() => {
    try {
      if (state.lines.length || state.tableId) localStorage.setItem(storageKey, JSON.stringify(state));
      else localStorage.removeItem(storageKey);
    } catch {
      /* storage unavailable */
    }
  }, [state, storageKey]);
  const totals: CartTotals = useMemo(
    () =>
      computeCart({
        lines: state.lines.map((l) => ({ id: l.id, variantId: l.variantId, name: l.name, qty: l.qty, unitPrice: l.unitPrice, modifiers: l.modifiers, discount: l.discount, taxRules: l.taxRules, unitCost: l.unitCost })),
        orderDiscount: state.orderDiscount,
      }),
    [state.lines, state.orderDiscount],
  );
  return { state, dispatch, totals };
}
