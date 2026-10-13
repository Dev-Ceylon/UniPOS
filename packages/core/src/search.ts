/**
 * In-memory product search index for the register. Built from the Dexie cache
 * so search works offline; target < 100 ms on 10,000 products.
 */

export interface SearchableItem {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export class SearchIndex<T extends SearchableItem> {
  private items: T[] = [];
  private byCode = new Map<string, T>();
  /** token prefix (first 2 chars) → item indices */
  private buckets = new Map<string, number[]>();
  private haystacks: string[] = [];

  constructor(items: readonly T[] = []) {
    this.reset(items);
  }

  reset(items: readonly T[]): void {
    this.items = [...items];
    this.byCode.clear();
    this.buckets.clear();
    this.haystacks = [];
    this.items.forEach((it, idx) => {
      if (it.barcode) this.byCode.set(it.barcode.trim(), it);
      if (it.sku) this.byCode.set(it.sku.trim().toLowerCase(), it);
      const hay = normalize([it.name, it.sku, it.barcode, it.category].filter(Boolean).join(" "));
      this.haystacks.push(hay);
      const seen = new Set<string>();
      for (const tok of hay.split(" ")) {
        const key = tok.slice(0, 2);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        let b = this.buckets.get(key);
        if (!b) this.buckets.set(key, (b = []));
        b.push(idx);
      }
    });
  }

  get size(): number {
    return this.items.length;
  }

  /** Exact barcode or SKU match (scanner input). */
  lookupCode(code: string): T | undefined {
    const c = code.trim();
    return this.byCode.get(c) ?? this.byCode.get(c.toLowerCase());
  }

  search(query: string, limit = 50): T[] {
    const q = normalize(query);
    if (!q) return this.items.slice(0, limit);
    const exact = this.lookupCode(query);
    const tokens = q.split(" ");
    const first = tokens.reduce((a, b) => (b.length > a.length ? b : a));
    const candidates = first.length >= 2 ? (this.buckets.get(first.slice(0, 2)) ?? []) : this.items.map((_, i) => i);
    const scored: { item: T; score: number }[] = [];
    for (const idx of candidates) {
      const hay = this.haystacks[idx]!;
      let score = 0;
      let ok = true;
      for (const t of tokens) {
        const pos = hay.indexOf(t);
        if (pos < 0) {
          ok = false;
          break;
        }
        // reward matches at word starts and in the name
        score += pos === 0 ? 3 : hay[pos - 1] === " " ? 2 : 1;
      }
      if (ok) scored.push({ item: this.items[idx]!, score });
    }
    scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
    const result = scored.slice(0, limit).map((s) => s.item);
    if (exact && !result.includes(exact)) result.unshift(exact);
    return result.slice(0, limit);
  }
}
