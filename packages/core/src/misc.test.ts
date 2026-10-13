import { describe, expect, it } from "vitest";
import { ean13CheckDigit, generateEan13, isValidEan13 } from "./barcode";
import { parseCsv, parseCsvObjects, toCsv } from "./csv";
import { buildCustomFieldSchema, parseCustomFields } from "./customFields";
import { balanceFromLedger, DEFAULT_LOYALTY, pointsEarned, pointsForAmount, pointsValue } from "./loyalty";
import { dependents, PRESETS, resolveModules, visibleNav, type NavItemMeta } from "./modules";
import { ALL_PERMISSIONS, assertCan, can, canAny, DEFAULT_ROLES, expandGrants, ForbiddenError, isValidGrant } from "./permissions";
import { cashVariance, countDenominations, expectedCash } from "./shift";
import { isUuid, uuidv7, uuidv7Timestamp } from "./uuid";
import { parseSettings, ProductInputSchema } from "./schemas";

describe("permissions", () => {
  it("checks grants and wildcards", () => {
    expect(can({ permissions: ["*"] }, "sales.refund")).toBe(true);
    expect(can({ permissions: ["sales.*"] }, "sales.refund")).toBe(true);
    expect(can({ permissions: ["sales.view"] }, "sales.refund")).toBe(false);
    expect(can(null, "sales.view")).toBe(false);
    expect(canAny({ permissions: ["sales.view"] }, ["sales.refund", "sales.view"])).toBe(true);
    expect(() => assertCan({ permissions: [] }, "products.edit")).toThrow(ForbiddenError);
    expect(expandGrants(["inventory.*"])).toContain("inventory.adjust");
    expect(isValidGrant("sales.*")).toBe(true);
    expect(isValidGrant("nope.*")).toBe(false);
    expect(isValidGrant("sales.refund")).toBe(true);
    expect(isValidGrant("*")).toBe(true);
  });

  it("default roles only grant real permissions", () => {
    for (const role of Object.values(DEFAULT_ROLES)) for (const g of role.permissions) expect(isValidGrant(g)).toBe(true);
    expect(expandGrants(DEFAULT_ROLES.owner!.permissions)).toEqual(ALL_PERMISSIONS);
    expect(can({ permissions: DEFAULT_ROLES.cashier!.permissions }, "sales.refund")).toBe(false);
    expect(can({ permissions: DEFAULT_ROLES.manager!.permissions }, "sales.refund")).toBe(true);
  });
});

describe("uuidv7", () => {
  it("is valid, time-ordered and unique", () => {
    const ids = Array.from({ length: 2000 }, () => uuidv7());
    expect(ids.every(isUuid)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    expect(ids[0]![14]).toBe("7");
    const t = Date.now();
    expect(Math.abs(uuidv7Timestamp(uuidv7(t)) - t)).toBeLessThanOrEqual(1);
    expect(isUuid("nope")).toBe(false);
  });
});

describe("shift", () => {
  it("computes expected cash and variance", () => {
    const exp = expectedCash({ openingFloat: 10000, cashSales: 52000, cashRefunds: 2000, cashIn: 1000, cashOut: 5000 });
    expect(exp).toBe(56000);
    expect(cashVariance(exp, 55500)).toBe(-500);
    expect(countDenominations({ "500000": 1, "10000": 3, "100": 5 })).toBe(530500);
    expect(() => countDenominations({ "100": -1 })).toThrow();
  });
});

describe("loyalty", () => {
  const rules = { ...DEFAULT_LOYALTY, enabled: true };
  it("earns and redeems points", () => {
    expect(pointsEarned(25000, rules)).toBe(2);
    expect(pointsEarned(-25000, rules)).toBe(-2);
    expect(pointsEarned(25000, DEFAULT_LOYALTY)).toBe(0);
    expect(pointsValue(150, rules)).toBe(15000);
    expect(pointsForAmount(1050, 200, rules)).toBe(11);
    expect(() => pointsForAmount(100, 50, rules)).toThrow();
    expect(() => pointsForAmount(100000, 150, rules)).toThrow();
    expect(() => pointsForAmount(100, 500, DEFAULT_LOYALTY)).toThrow();
    expect(balanceFromLedger([{ points: 10 }, { points: -3 }])).toBe(7);
  });
});

describe("csv", () => {
  it("round-trips with quoting and blocks formula injection", () => {
    const csv = toCsv([{ name: 'Tea, "Ceylon"', price: "1.00" }, { name: "=SUM(A1)", price: "-2" }]);
    expect(csv).toContain('"Tea, ""Ceylon"""');
    expect(csv).toContain("'=SUM(A1)");
    const rows = parseCsvObjects(csv);
    expect(rows[0]).toEqual({ name: 'Tea, "Ceylon"', price: "1.00" });
    expect(rows[1]!.price).toBe("-2");
    expect(parseCsv("a,b\n1,\"x\ny\"\r\n")).toEqual([["a", "b"], ["1", "x\ny"]]);
    expect(parseCsvObjects("")).toEqual([]);
    expect(toCsv([{ a: null }])).toBe("a\r\n\r\n");
  });
});

describe("barcode", () => {
  it("computes EAN-13 check digits", () => {
    expect(ean13CheckDigit("400638133393")).toBe(1);
    expect(isValidEan13("4006381333931")).toBe(true);
    expect(isValidEan13("4006381333932")).toBe(false);
    const code = generateEan13(42);
    expect(code).toHaveLength(13);
    expect(isValidEan13(code)).toBe(true);
    expect(() => generateEan13(1, "40")).toThrow();
    expect(() => generateEan13(-1)).toThrow();
    expect(() => ean13CheckDigit("1")).toThrow();
  });
});

describe("custom fields", () => {
  const defs = [
    { key: "brand", label: "Brand", type: "text" as const, required: true },
    { key: "abv", label: "ABV", type: "number" as const, required: false },
    { key: "organic", label: "Organic", type: "boolean" as const, required: false },
    { key: "expiry", label: "Expiry", type: "date" as const, required: false },
    { key: "size", label: "Size", type: "select" as const, required: false, options: ["S", "M"] },
  ];
  it("validates by tenant definition", () => {
    expect(parseCustomFields(defs, { brand: "Dilmah", abv: "4.5", organic: "on", expiry: "2027-01-01", size: "M", junk: 1 })).toEqual({
      brand: "Dilmah",
      abv: 4.5,
      organic: true,
      expiry: "2027-01-01",
      size: "M",
    });
    expect(() => parseCustomFields(defs, {})).toThrow();
    expect(() => parseCustomFields(defs, { brand: "x", size: "XL" })).toThrow();
    expect(buildCustomFieldSchema([]).parse(undefined ?? {})).toEqual({});
  });
});

describe("modules and presets", () => {
  it("resolves required modules and dependencies", () => {
    const r = resolveModules(["loyalty", "bogus"]);
    expect(r).toEqual(expect.arrayContaining(["core", "register", "catalog", "loyalty", "customers"]));
    expect(r).not.toContain("bogus");
    expect(dependents("customers", ["customers", "loyalty"])).toEqual(["loyalty"]);
  });

  it("switching preset changes the visible nav", () => {
    const nav: NavItemMeta[] = [
      { href: "/register", labelKey: "register", icon: "x", module: "register", order: 1 },
      { href: "/kitchen", labelKey: "kitchen", icon: "x", module: "restaurant", order: 2 },
      { href: "/inventory", labelKey: "inventory", icon: "x", module: "inventory", order: 3, permission: "inventory.view" },
    ];
    const all = () => true;
    expect(visibleNav(nav, PRESETS.retail.modules, all).map((n) => n.href)).toEqual(["/register", "/inventory"]);
    expect(visibleNav(nav, PRESETS.cafe.modules, all).map((n) => n.href)).toEqual(["/register", "/kitchen"]);
    expect(visibleNav(nav, PRESETS.retail.modules, () => false).map((n) => n.href)).toEqual(["/register"]);
    expect(PRESETS.restaurant.registerLayout).toBe("restaurant");
  });
});

describe("schemas", () => {
  it("defaults tenant settings and validates products", () => {
    const s = parseSettings({ discountThresholdBp: 5000 });
    expect(s.discountThresholdBp).toBe(5000);
    expect(s.receipt.paperWidthMm).toBe(80);
    expect(parseSettings({ discountThresholdBp: "bad" }).discountThresholdBp).toBe(2000);
    expect(ProductInputSchema.safeParse({ name: "Tea", variants: [{ price: 100 }] }).success).toBe(true);
    expect(ProductInputSchema.safeParse({ name: "", variants: [] }).success).toBe(false);
  });
});
