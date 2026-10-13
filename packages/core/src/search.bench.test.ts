import { describe, expect, it } from "vitest";
import { normalize, SearchIndex } from "./search";

const words = [
  "tea",
  "coffee",
  "milk",
  "sugar",
  "rice",
  "flour",
  "soap",
  "biscuit",
  "noodles",
  "chilli",
  "curry",
  "powder",
  "oil",
  "salt",
  "bread",
  "butter",
  "jam",
  "juice",
  "water",
  "soda",
];

function makeProducts(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `${words[i % 20]} ${words[(i * 7) % 20]} ${i % 13 === 0 ? "Ceylon" : "Classic"} ${i}g`,
    sku: `SKU-${String(i).padStart(5, "0")}`,
    barcode: String(4790000000000 + i),
    category: words[(i * 3) % 20],
  }));
}

describe("search index", () => {
  it("finds by name tokens, sku and barcode", () => {
    const idx = new SearchIndex([
      { id: "1", name: "Ceylon Tea 100g", sku: "TEA-1", barcode: "4790001" },
      { id: "2", name: "Milk Powder", sku: "MLK-1", barcode: "4790002" },
      { id: "3", name: "Café Latte", sku: null, barcode: null },
    ]);
    expect(idx.size).toBe(3);
    expect(idx.search("tea").map((p) => p.id)).toEqual(["1"]);
    expect(idx.search("milk pow").map((p) => p.id)).toEqual(["2"]);
    expect(idx.search("cafe")[0]!.id).toBe("3");
    expect(idx.lookupCode("4790002")?.id).toBe("2");
    expect(idx.lookupCode("tea-1")?.id).toBe("1");
    expect(idx.search("4790001")[0]!.id).toBe("1");
    expect(idx.search("")).toHaveLength(3);
    expect(idx.search("c").length).toBeGreaterThan(0);
    expect(idx.search("zzz")).toEqual([]);
    expect(normalize("  Crème-Brûlée! ")).toBe("creme brulee");
  });

  it("searches 10,000 products in under 100 ms", () => {
    const products = makeProducts(10_000);
    const idx = new SearchIndex(products);
    const queries = ["tea", "classic coffee", "ceylon", "SKU-09999", "4790000005000", "bis", "ceylon curr", "soda 99"];
    for (const q of queries) {
      const t0 = performance.now();
      const r = idx.search(q);
      const ms = performance.now() - t0;
      expect(ms).toBeLessThan(100);
      expect(r.length).toBeGreaterThan(0);
    }
  });
});
