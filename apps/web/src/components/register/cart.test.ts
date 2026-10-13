import { describe, expect, it } from "vitest";
import { cartReducer, emptyCart, type CartLine } from "./cart";

const base: Omit<CartLine, "id" | "qty"> = {
  variantId: "v1",
  name: "Tea",
  unitPrice: 1000,
  catalogPrice: 1000,
  unitCost: 500,
  modifiers: [],
  discount: null,
  taxRules: [],
};

describe("register cart reducer", () => {
  it("merges identical lines and keeps modifier variants separate", () => {
    let s = cartReducer(emptyCart(), { type: "add", line: base });
    s = cartReducer(s, { type: "add", line: base });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]!.qty).toBe(2);
    s = cartReducer(s, { type: "add", line: { ...base, modifiers: [{ name: "Milk", priceDelta: 100 }] } });
    expect(s.lines).toHaveLength(2);
  });

  it("removes a line when quantity reaches zero", () => {
    let s = cartReducer(emptyCart(), { type: "add", line: base });
    s = cartReducer(s, { type: "inc", id: s.lines[0]!.id, by: -1 });
    expect(s.lines).toHaveLength(0);
  });

  it("never reduces below what was already sent to the kitchen", () => {
    let s = cartReducer(emptyCart(), { type: "add", line: { ...base, qty: 3 } });
    s = cartReducer(s, { type: "markSent" });
    const id = s.lines[0]!.id;
    s = cartReducer(s, { type: "qty", id, qty: 1 });
    expect(s.lines[0]!.qty).toBe(3);
    s = cartReducer(s, { type: "remove", id });
    expect(s.lines[0]!.qty).toBe(3);
    // new items after sending start a new line
    s = cartReducer(s, { type: "add", line: base });
    expect(s.lines).toHaveLength(2);
  });

  it("sets discounts, price, customer and clears", () => {
    let s = cartReducer(emptyCart(), { type: "add", line: base });
    const id = s.lines[0]!.id;
    s = cartReducer(s, { type: "lineDiscount", id, discount: { type: "percent", valueBp: 1000 } });
    s = cartReducer(s, { type: "price", id, unitPrice: 900 });
    s = cartReducer(s, { type: "orderDiscount", discount: { type: "amount", value: 50 } });
    s = cartReducer(s, { type: "customer", id: "c1", name: "Ashen" });
    s = cartReducer(s, { type: "lineNote", id, note: "no sugar" });
    expect(s.lines[0]).toMatchObject({ unitPrice: 900, note: "no sugar", discount: { type: "percent", valueBp: 1000 } });
    expect(s.customerName).toBe("Ashen");
    s = cartReducer(s, { type: "table", id: "t1", name: "T1", covers: 2 });
    expect(s).toMatchObject({ tableId: "t1", covers: 2, customerId: "c1", lines: [] });
    expect(cartReducer(s, { type: "clear" })).toEqual(emptyCart());
  });
});
