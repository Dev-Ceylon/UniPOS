"use client";
import {
  buildReceipt,
  discountRatioBp,
  formatMoney,
  SearchIndex,
  uuidv7,
  type ModuleId,
  type Permission,
  type ReceiptTemplate,
  type SalePayload,
  type Tender,
} from "@unipos/core";
import { Alert, Badge, Button, cn, Dialog, Field, Input, Kbd } from "@unipos/ui";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, ChefHat, Minus, Pause, Percent, Play, Plus, RefreshCw, Search, Tag, Trash2, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { emailReceipt, listTables, loadTab, openShiftAction, quickCreateCustomer, saveTab, sendToKitchen } from "@/app/(app)/register/actions";
import { ReceiptView } from "@/components/receipt-view";
import { posDb, setMeta, type CachedProduct } from "@/offline/db";
import { useEngine, useSyncState } from "@/offline/provider";
import { useCart, type CartLine } from "./cart";
import { CameraScanner, CustomerDialog, DiscountDialog, ModifierDialog, PriceDialog } from "./dialogs";
import { PaymentDialog, type PaymentLine } from "./payment";

export interface RegisterProps {
  tenantId: string;
  tenantName: string;
  currency: string;
  locale: string;
  timeZone: string;
  location: { id: string; name: string; code: string; address: string | null; receiptHeader: string | null };
  member: { id: string; name: string };
  perms: Record<Permission, boolean>;
  modules: ModuleId[];
  settings: {
    receipt: ReceiptTemplate;
    discountThresholdBp: number;
    loyalty: { enabled: boolean; spendPerPoint: number; pointValue: number; minRedeem: number };
    layout: "retail" | "restaurant";
    askCovers: boolean;
  };
  shift: { id: string; openedAt: string } | null;
}

type TableInfo = { id: string; name: string; area: string; seats: number; occupied: boolean; covers: number };

export function Register(p: RegisterProps) {
  const t = useTranslations("register");
  const router = useRouter();
  const engine = useEngine();
  const sync = useSyncState();
  const db = useMemo(() => posDb(p.tenantId), [p.tenantId]);
  const m = useCallback((v: number) => formatMoney(v, p.currency, p.locale === "en" ? "en-LK" : p.locale), [p.currency, p.locale]);
  const restaurant = p.settings.layout === "restaurant" && p.modules.includes("restaurant");

  const products = useLiveQuery(() => db.products.toArray(), [db]);
  const categories = useLiveQuery(() => db.categories.orderBy("sortOrder").toArray(), [db]) ?? [];
  const modifierGroupsQ = useLiveQuery(() => db.modifierGroups.toArray(), [db]);
  const modifierGroups = useMemo(() => modifierGroupsQ ?? [], [modifierGroupsQ]);
  const customers = useLiveQuery(() => db.customers.toArray(), [db]) ?? [];
  const held = useLiveQuery(() => db.held.orderBy("createdAt").reverse().toArray(), [db]) ?? [];
  const index = useMemo(() => new SearchIndex(products ?? []), [products]);
  const { state, dispatch, totals } = useCart(`unipos_cart_${p.tenantId}_${p.location.id}`);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("fav");
  const [shift, setShift] = useState(p.shift);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [dialog, setDialog] = useState<
    null | "pay" | "customer" | "orderDiscount" | "lineDiscount" | "price" | "held" | "camera" | "shift" | "covers" | "shortcuts"
  >(null);
  const [modProduct, setModProduct] = useState<CachedProduct | null>(null);
  const [done, setDone] = useState<null | { payload: SalePayload; receipt: ReturnType<typeof buildReceipt>; change: number }>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = state.lines.find((l) => l.id === state.selectedId) ?? state.lines.at(-1) ?? null;
  const customer = customers.find((c) => c.id === state.customerId) ?? null;

  // ── Catalog cache ──
  const refreshCatalog = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setLoadingCatalog(true);
    try {
      const res = await fetch(`/api/v1/catalog?locationId=${p.location.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 401 ? "Signed out" : `Catalog error ${res.status}`);
      const data = await res.json();
      await db.transaction("rw", [db.products, db.categories, db.modifierGroups, db.customers, db.meta], async () => {
        await Promise.all([db.products.clear(), db.categories.clear(), db.modifierGroups.clear(), db.customers.clear()]);
        await db.products.bulkPut(data.products);
        await db.categories.bulkPut(data.categories);
        await db.modifierGroups.bulkPut(data.modifierGroups);
        await db.customers.bulkPut(data.customers);
        await setMeta(db, "catalogAt", data.generatedAt);
      });
      setCatalogError(null);
    } catch (e) {
      setCatalogError((e as Error).message);
    } finally {
      setLoadingCatalog(false);
    }
  }, [db, p.location.id]);

  useEffect(() => {
    void refreshCatalog();
    const id = setInterval(() => void refreshCatalog(), 5 * 60_000);
    const onOnline = () => void refreshCatalog();
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", onOnline);
    };
  }, [refreshCatalog]);

  // ── Restaurant tables ──
  const refreshTables = useCallback(async () => {
    if (!restaurant || !navigator.onLine) return;
    const res = await listTables();
    if (res.ok) setTables(res.data);
  }, [restaurant]);
  useEffect(() => {
    void refreshTables();
    if (!restaurant) return;
    const id = setInterval(() => void refreshTables(), 10_000);
    return () => clearInterval(id);
  }, [refreshTables, restaurant]);

  // Persist the open table's tab (debounced) so other devices see it.
  useEffect(() => {
    if (!restaurant || !state.tableId || !navigator.onLine) return;
    const id = setTimeout(() => void saveTab(state.tableId!, state.covers ?? 0, state.lines), 600);
    return () => clearTimeout(id);
  }, [restaurant, state.tableId, state.covers, state.lines]);

  // ── Adding products ──
  const addProduct = useCallback(
    (prod: CachedProduct, mods: { name: string; priceDelta: number }[] = [], note = "", course?: number) => {
      dispatch({
        type: "add",
        line: {
          variantId: prod.id,
          name: prod.variantName ? `${prod.name} — ${prod.variantName}` : prod.name,
          unitPrice: prod.price,
          catalogPrice: prod.price,
          unitCost: prod.cost,
          modifiers: mods,
          discount: null,
          taxRules: prod.taxRules,
          note: note || undefined,
          course,
        },
      });
    },
    [dispatch],
  );

  const pick = useCallback(
    (prod: CachedProduct) => {
      if (prod.modifierGroupIds.length && modifierGroups.some((g) => prod.modifierGroupIds.includes(g.id))) setModProduct(prod);
      else addProduct(prod);
    },
    [addProduct, modifierGroups],
  );

  const onScan = useCallback(
    (code: string) => {
      const hit = index.lookupCode(code);
      if (hit) {
        pick(hit);
        setQuery("");
        return true;
      }
      return false;
    },
    [index, pick],
  );

  const results = useMemo(() => {
    if (!products) return [];
    if (query.trim()) return index.search(query, 60);
    if (category === "fav") {
      const favs = products.filter((x) => x.favourite);
      return favs.length ? favs : products.slice(0, 60);
    }
    if (category === "all") return products.slice(0, 200);
    return products.filter((x) => x.categoryId === category).slice(0, 200);
  }, [products, index, query, category]);

  // ── Sale completion ──
  const discountBlocked = totals.discountTotal > 0 && discountRatioBp(totals) > p.settings.discountThresholdBp && !p.perms["sales.discount_override"];

  const receiptFor = useCallback(
    (payload: SalePayload, payments: PaymentLine[], change: number) =>
      buildReceipt(
        {
          number: payload.number,
          createdAt: payload.createdAt,
          businessName: p.tenantName,
          locationName: p.location.name,
          locationAddress: p.location.address,
          receiptHeader: p.location.receiptHeader,
          cashier: p.member.name,
          customer: state.customerName,
          table: state.tableName,
          lines: totals.lines.map((l) => ({
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            total: l.total,
            discount: l.lineDiscount + l.orderDiscount,
            modifiers: l.modifiers,
          })),
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxes: totals.taxes,
          taxTotal: totals.taxTotal,
          total: totals.total,
          payments: payments.map((x) => ({ tender: x.tender, amount: x.amount })),
          change,
          currency: p.currency,
          locale: p.locale,
          timeZone: p.timeZone,
        },
        p.settings.receipt,
      ),
    [p, state.customerName, state.tableName, totals],
  );

  const complete = async (payments: PaymentLine[], change: number) => {
    if (!engine) return;
    const payload: SalePayload = {
      clientId: uuidv7(),
      number: await engine.nextSaleNumber(p.location.code),
      locationId: p.location.id,
      shiftId: shift?.id ?? null,
      memberId: p.member.id,
      customerId: state.customerId,
      tableId: state.tableId,
      covers: state.covers,
      quoteId: state.quoteId,
      createdAt: new Date().toISOString(),
      lines: state.lines.map((l) => ({
        id: l.id,
        variantId: l.variantId,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        catalogPrice: l.catalogPrice,
        unitCost: l.unitCost,
        modifiers: l.modifiers,
        discount: l.discount,
        taxRules: l.taxRules,
        note: l.note,
        course: l.course,
      })),
      orderDiscount: state.orderDiscount,
      payments: payments.map((x) => ({ id: x.id, tender: x.tender, amount: x.amount, reference: x.reference })),
      change,
      expected: { total: totals.total, taxTotal: totals.taxTotal },
      note: state.note || undefined,
    };
    const receipt = receiptFor(payload, payments, change);
    await engine.enqueueSale(payload, receipt);
    // optimistic stock update in the local cache
    await db.transaction("rw", db.products, async () => {
      for (const l of payload.lines) {
        const prod = await db.products.get(l.variantId);
        if (prod && prod.onHand !== null) await db.products.update(l.variantId, { onHand: prod.onHand - l.qty });
      }
    });
    setDialog(null);
    setDone({ payload, receipt, change });
    dispatch({ type: "clear" });
    if (restaurant) setTimeout(() => void refreshTables(), 1500);
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done && (e.key === "Enter" || e.key === "Escape")) {
        e.preventDefault();
        setDone(null);
        searchRef.current?.focus();
        return;
      }
      if (dialog || done || modProduct) return;
      const inField = (e.target as HTMLElement)?.tagName === "INPUT" && e.target !== searchRef.current;
      if (inField) return;
      if (e.key === "F2" || (e.key === "/" && e.target !== searchRef.current)) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F4" || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        if (state.lines.length && !discountBlocked) setDialog("pay");
      } else if (e.key === "F6") {
        e.preventDefault();
        if (p.modules.includes("customers")) setDialog("customer");
      } else if (e.key === "F7") {
        e.preventDefault();
        if (p.perms["sales.discount"] && state.lines.length) setDialog("orderDiscount");
      } else if (e.key === "F8") {
        e.preventDefault();
        void holdSale();
      } else if (e.key === "F9") {
        e.preventDefault();
        setDialog("held");
      } else if (e.key === "?" && e.shiftKey && !query) {
        e.preventDefault();
        setDialog("shortcuts");
      } else if (!query && selected && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        dispatch({ type: "inc", id: selected.id, by: 1 });
      } else if (!query && selected && e.key === "-") {
        e.preventDefault();
        dispatch({ type: "inc", id: selected.id, by: -1 });
      } else if (!query && selected && e.key === "Delete") {
        e.preventDefault();
        dispatch({ type: "remove", id: selected.id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function holdSale() {
    if (!state.lines.length || state.tableId) return;
    await db.held.put({
      id: uuidv7(),
      label: state.customerName ?? `${state.lines[0]!.name}${state.lines.length > 1 ? ` +${state.lines.length - 1}` : ""}`,
      createdAt: new Date().toISOString(),
      cart: state,
    });
    dispatch({ type: "clear" });
    toast.success(t("hold"));
  }

  async function openTable(tbl: TableInfo) {
    const res = await loadTab(tbl.id);
    const lines = res.ok && res.data ? (res.data.lines as CartLine[]) : [];
    dispatch({ type: "table", id: tbl.id, name: tbl.name, covers: res.ok && res.data ? res.data.covers : 0, lines });
    if (!lines.length && p.settings.askCovers) setDialog("covers");
  }

  const tenders: Tender[] = [
    "cash",
    "card",
    "wallet",
    ...(p.modules.includes("giftcards") ? (["gift_card"] as Tender[]) : []),
    ...(p.modules.includes("loyalty") && p.settings.loyalty.enabled && customer ? (["points"] as Tender[]) : []),
    "other",
  ];
  const unsent = state.lines.some((l) => l.qty > (l.sentQty ?? 0));

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:flex-row">
      {/* Left: products */}
      <section className="flex min-h-0 flex-1 flex-col border-border lg:border-r" aria-label="Products">
        {!sync?.online ? (
          <div className="bg-warning-soft px-3 py-1.5 text-sm text-warning" role="status">
            {t("offlineMode")}
          </div>
        ) : null}
        {!shift ? (
          <div className="flex items-center justify-between gap-2 bg-surface-2 px-3 py-1.5 text-sm">
            <span>{t("noShift")}</span>
            {p.perms["shifts.manage"] ? (
              <Button size="sm" variant="outline" onClick={() => setDialog("shift")}>
                {t("openShift")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {restaurant ? (
          <div className="flex gap-2 overflow-x-auto border-b border-border p-2" role="toolbar" aria-label={t("chooseTable")}>
            <Button size="sm" variant={!state.tableId ? "primary" : "outline"} onClick={() => dispatch({ type: "table", id: null, name: null })}>
              Takeaway
            </Button>
            {tables.map((tbl) => (
              <Button
                key={tbl.id}
                size="sm"
                variant={state.tableId === tbl.id ? "primary" : "outline"}
                className={cn(tbl.occupied && state.tableId !== tbl.id && "border-warning text-warning")}
                onClick={() => void openTable(tbl)}
                aria-label={`${t("table")} ${tbl.name}${tbl.occupied ? " (occupied)" : ""}`}
              >
                {tbl.name}
                {tbl.occupied ? <span className="h-2 w-2 rounded-full bg-warning" aria-hidden /> : null}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="flex gap-2 p-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!query.trim()) return;
                  if (onScan(query.trim())) return;
                  if (results.length === 1) {
                    pick(results[0]!);
                    setQuery("");
                  } else if (!results.length) toast.error(t("notFound", { code: query }));
                } else if (e.key === "Escape") setQuery("");
              }}
              placeholder={t("search")}
              aria-label={t("search")}
              className="h-12 pl-9 text-base"
              data-testid="register-search"
            />
          </div>
          <Button variant="outline" size="lg" aria-label={t("scanCamera")} onClick={() => setDialog("camera")}>
            <Camera className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="lg" aria-label={t("refreshCatalog")} onClick={() => void refreshCatalog()} disabled={loadingCatalog}>
            <RefreshCw className={cn("h-5 w-5", loadingCatalog && "animate-spin")} />
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 pb-2" role="tablist" aria-label="Categories">
          {[{ id: "fav", name: t("favourites") }, { id: "all", name: t("allItems") }, ...categories].map((c) => (
            <Button
              key={c.id}
              role="tab"
              className="shrink-0 whitespace-nowrap"
              aria-selected={category === c.id && !query}
              size="sm"
              variant={category === c.id && !query ? "primary" : "secondary"}
              onClick={() => {
                setCategory(c.id);
                setQuery("");
              }}
            >
              {c.name}
            </Button>
          ))}
        </div>
        {catalogError && !products?.length ? (
          <div className="px-3">
            <Alert tone="danger">{catalogError}</Alert>
          </div>
        ) : null}
        <div
          className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3 pt-0 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          data-testid="product-grid"
        >
          {products === undefined ? <p className="col-span-full p-6 text-center text-muted">{t("loadingCatalog")}</p> : null}
          {results.map((prod) => (
            <button
              key={prod.id}
              type="button"
              onClick={() => pick(prod)}
              className="flex min-h-24 flex-col justify-between rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition hover:border-primary focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            >
              <span className="line-clamp-2 text-sm font-medium">
                {prod.name}
                {prod.variantName ? <span className="text-muted"> — {prod.variantName}</span> : null}
              </span>
              <span className="mt-2 flex items-end justify-between gap-1">
                <span className="tabular font-semibold text-primary-ink">{m(prod.price)}</span>
                {prod.onHand !== null ? <span className={cn("text-xs", prod.onHand <= 0 ? "text-danger" : "text-muted")}>{prod.onHand} left</span> : null}
              </span>
            </button>
          ))}
          {products && !results.length ? (
            <p className="col-span-full p-6 text-center text-muted">{query ? t("notFound", { code: query }) : "No products yet. Add products in Products."}</p>
          ) : null}
        </div>
      </section>

      {/* Right: cart */}
      <section className="flex max-h-[55dvh] min-h-0 w-full flex-col bg-surface lg:max-h-none lg:w-[400px] xl:w-[440px]" aria-label={t("cart")}>
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0">
            <h2 className="font-semibold">
              {state.tableName ? `${t("table")} ${state.tableName}` : t("cart")}
              {state.covers ? (
                <span className="ml-1 text-sm font-normal text-muted">
                  · {state.covers} {t("covers")}
                </span>
              ) : null}
            </h2>
            {p.modules.includes("customers") ? (
              <button type="button" className="flex items-center gap-1 truncate text-sm text-primary-ink hover:underline" onClick={() => setDialog("customer")}>
                <UserRound className="h-3.5 w-3.5" aria-hidden />
                {state.customerName ?? t("noCustomer")}
                {customer?.points ? <Badge tone="primary">{customer.points} pts</Badge> : null}
              </button>
            ) : null}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setDialog("held")} aria-label={`${t("resume")} (F9)`}>
              <Play className="h-4 w-4" aria-hidden />
              {held.length ? <Badge tone="warning">{held.length}</Badge> : null}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void holdSale()}
              disabled={!state.lines.length || !!state.tableId}
              aria-label={`${t("hold")} (F8)`}
            >
              <Pause className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "clear" })}
              disabled={!state.lines.length && !state.customerId}
              aria-label={t("clear")}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto" aria-label={t("cart")} data-testid="cart-lines">
          {!state.lines.length ? <li className="p-8 text-center text-sm text-muted">{t("emptyCart")}</li> : null}
          {totals.lines.map((l, i) => {
            const src = state.lines[i]!;
            const isSel = selected?.id === l.id;
            return (
              <li
                key={l.id}
                className={cn("border-b border-border px-3 py-2", isSel && "bg-primary-soft")}
                onClick={() => dispatch({ type: "select", id: l.id })}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted">
                      {m(l.unitPrice)}
                      {src.unitPrice !== src.catalogPrice ? <span className="ml-1 text-warning">(was {m(src.catalogPrice)})</span> : null}
                      {l.modifiers.length ? ` · ${l.modifiers.map((x) => x.name).join(", ")}` : ""}
                      {src.note ? ` · “${src.note}”` : ""}
                      {src.sentQty ? (
                        <span className="ml-1 text-success">
                          · {t("sent")} {src.sentQty}
                        </span>
                      ) : null}
                    </p>
                    {l.lineDiscount + l.orderDiscount ? <p className="text-xs text-success">−{m(l.lineDiscount + l.orderDiscount)}</p> : null}
                  </div>
                  <p className="tabular shrink-0 text-sm font-semibold">{m(l.total)}</p>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <Button size="sm" variant="outline" aria-label={`Decrease ${l.name}`} onClick={() => dispatch({ type: "inc", id: l.id, by: -1 })}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <input
                    aria-label={`Quantity of ${l.name}`}
                    className="h-8 w-12 rounded border border-border bg-surface text-center text-sm"
                    inputMode="numeric"
                    value={l.qty}
                    onChange={(e) => {
                      const q = parseInt(e.target.value, 10);
                      if (Number.isFinite(q)) dispatch({ type: "qty", id: l.id, qty: q });
                    }}
                  />
                  <Button size="sm" variant="outline" aria-label={`Increase ${l.name}`} onClick={() => dispatch({ type: "inc", id: l.id, by: 1 })}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  {isSel ? (
                    <span className="ml-auto flex gap-1">
                      {p.perms["sales.discount"] ? (
                        <Button size="sm" variant="ghost" aria-label={t("lineDiscount")} onClick={() => setDialog("lineDiscount")}>
                          <Percent className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {p.perms["sales.price_override"] ? (
                        <Button size="sm" variant="ghost" aria-label={t("price")} onClick={() => setDialog("price")}>
                          <Tag className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" aria-label={`${t("remove")} ${l.name}`} onClick={() => dispatch({ type: "remove", id: l.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border p-3">
          <dl className="flex flex-col gap-0.5 text-sm">
            <div className="flex justify-between">
              <dt>{t("subtotal")}</dt>
              <dd className="tabular">{m(totals.subtotal)}</dd>
            </div>
            {totals.discountTotal ? (
              <div className="flex justify-between text-success">
                <dt>{t("discount")}</dt>
                <dd className="tabular">−{m(totals.discountTotal)}</dd>
              </div>
            ) : null}
            {totals.taxes.map((tx) => (
              <div key={tx.ruleId} className="flex justify-between text-muted">
                <dt>
                  {tx.name} {tx.rateBp / 100}%{tx.inclusive ? " incl." : ""}
                </dt>
                <dd className="tabular">{m(tx.amount)}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between text-xl font-bold">
              <dt>{t("total")}</dt>
              <dd className="tabular" data-testid="cart-total">
                {m(totals.total)}
              </dd>
            </div>
          </dl>
          {discountBlocked ? (
            <div className="mt-2">
              <Alert tone="warning">
                Discount above {(p.settings.discountThresholdBp / 100).toFixed(0)}% needs a manager. Switch cashier to a manager to continue.
              </Alert>
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {p.perms["sales.discount"] ? (
              <Button variant="outline" disabled={!state.lines.length} onClick={() => setDialog("orderDiscount")}>
                <Percent className="h-4 w-4" aria-hidden /> {t("discount")}
              </Button>
            ) : (
              <span />
            )}
            {restaurant ? (
              <Button
                variant="outline"
                disabled={!unsent}
                onClick={async () => {
                  const res = await sendToKitchen(state.tableId, state.tableName ?? "Takeaway", state.lines);
                  if (!res.ok) return toast.error(res.error);
                  dispatch({ type: "markSent" });
                  toast.success(`${t("sent")} (${res.data.tickets})`);
                  void refreshTables();
                }}
              >
                <ChefHat className="h-4 w-4" aria-hidden /> {t("sendToKitchen")}
              </Button>
            ) : (
              <span />
            )}
            <Button
              size="lg"
              className="col-span-3 h-14 text-lg"
              disabled={!state.lines.length || discountBlocked || totals.total < 0}
              onClick={() => setDialog("pay")}
              data-testid="pay-button"
            >
              {t("pay")} {m(totals.total)} <Kbd>F4</Kbd>
            </Button>
          </div>
          <button type="button" className="mt-2 w-full text-center text-xs text-muted underline" onClick={() => setDialog("shortcuts")}>
            {t("shortcuts")} (?)
          </button>
        </div>
      </section>

      {/* Dialogs */}
      <PaymentDialog
        open={dialog === "pay"}
        total={totals.total}
        currency={p.currency}
        tenders={tenders}
        customerPoints={customer ? customer.points : null}
        pointValue={p.settings.loyalty.pointValue}
        onClose={() => setDialog(null)}
        onComplete={complete}
      />
      <CustomerDialog
        open={dialog === "customer"}
        customers={customers}
        canCreate={p.perms["customers.edit"]}
        onClose={() => setDialog(null)}
        onPick={(c) => {
          dispatch({ type: "customer", id: c?.id ?? null, name: c?.name ?? null });
          setDialog(null);
        }}
        onCreate={async (c) => {
          if (!navigator.onLine) return "Creating customers needs a connection";
          const res = await quickCreateCustomer(c);
          if (!res.ok) return res.error;
          await db.customers.put(res.data);
          dispatch({ type: "customer", id: res.data.id, name: res.data.name });
          setDialog(null);
          return null;
        }}
      />
      <DiscountDialog
        open={dialog === "orderDiscount"}
        title={t("orderDiscount")}
        currency={p.currency}
        current={state.orderDiscount}
        onClose={() => setDialog(null)}
        onApply={(d) => {
          dispatch({ type: "orderDiscount", discount: d });
          setDialog(null);
        }}
      />
      <DiscountDialog
        open={dialog === "lineDiscount"}
        title={t("lineDiscount")}
        currency={p.currency}
        current={selected?.discount ?? null}
        onClose={() => setDialog(null)}
        onApply={(d) => {
          if (selected) dispatch({ type: "lineDiscount", id: selected.id, discount: d });
          setDialog(null);
        }}
      />
      <PriceDialog
        open={dialog === "price"}
        currency={p.currency}
        price={selected?.unitPrice ?? 0}
        onClose={() => setDialog(null)}
        onApply={(v) => {
          if (selected) dispatch({ type: "price", id: selected.id, unitPrice: v });
          setDialog(null);
        }}
      />
      <ModifierDialog
        product={modProduct}
        groups={modifierGroups}
        currency={p.currency}
        onClose={() => setModProduct(null)}
        onAdd={(mods, note, course) => {
          if (modProduct) addProduct(modProduct, mods, note, course);
          setModProduct(null);
        }}
      />
      <CameraScanner
        open={dialog === "camera"}
        onClose={() => setDialog(null)}
        onCode={(code) => {
          setDialog(null);
          if (!onScan(code)) toast.error(t("notFound", { code }));
        }}
      />
      <Dialog open={dialog === "held"} onClose={() => setDialog(null)} title={t("held")}>
        <ul className="flex flex-col gap-2">
          {held.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 rounded border border-border p-2">
              <span className="text-sm">
                {h.label} <span className="text-muted">· {new Date(h.createdAt).toLocaleTimeString()}</span>
              </span>
              <span className="flex gap-1">
                <Button
                  size="sm"
                  onClick={async () => {
                    setDialog(null);
                    if (state.lines.length) await holdSale();
                    await db.held.delete(h.id);
                    dispatch({ type: "load", state: h.cart as never });
                  }}
                >
                  {t("resume")}
                </Button>
                <Button size="sm" variant="ghost" aria-label="Discard held sale" onClick={() => db.held.delete(h.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </li>
          ))}
          {!held.length ? <li className="text-sm text-muted">No held sales.</li> : null}
        </ul>
      </Dialog>
      <Dialog open={dialog === "shift"} onClose={() => setDialog(null)} title={t("openShift")} size="sm">
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await openShiftAction(String(new FormData(e.currentTarget).get("float") ?? "0"));
            if (!res.ok) return toast.error(res.error);
            setShift(res.data);
            setDialog(null);
            router.refresh();
          }}
        >
          <Field label={`${t("openingFloat")} (${p.currency})`} htmlFor="float">
            <Input id="float" name="float" inputMode="decimal" autoFocus defaultValue="0" />
          </Field>
          <Button type="submit">{t("openShift")}</Button>
        </form>
      </Dialog>
      <Dialog open={dialog === "covers"} onClose={() => setDialog(null)} title={t("covers")} size="sm">
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <Button
              key={n}
              variant="secondary"
              size="lg"
              onClick={() => {
                dispatch({ type: "table", id: state.tableId, name: state.tableName, covers: n, lines: state.lines });
                setDialog(null);
              }}
            >
              {n}
            </Button>
          ))}
        </div>
      </Dialog>
      <Dialog open={dialog === "shortcuts"} onClose={() => setDialog(null)} title={t("shortcuts")} size="sm">
        <ul className="flex flex-col gap-2 text-sm">
          {[
            ["F2 or /", "Search / scan"],
            ["Enter", "Add scanned code or single match"],
            ["F4 or Ctrl+Enter", "Pay"],
            ["F6", "Customer"],
            ["F7", "Order discount"],
            ["F8", "Hold sale"],
            ["F9", "Resume held sale"],
            ["+ / −", "Change quantity of selected line"],
            ["Delete", "Remove selected line"],
            ["Esc", "Clear search / close"],
          ].map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <Kbd>{k}</Kbd>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </Dialog>
      <Dialog
        open={!!done}
        onClose={() => setDone(null)}
        title={t("completed")}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              {t("printReceipt")}
            </Button>
            {done && p.modules.includes("customers") ? (
              <EmailReceiptButton saleId={done.payload.clientId} defaultEmail={customers.find((c) => c.id === done.payload.customerId)?.email ?? ""} />
            ) : null}
            <Button
              autoFocus
              onClick={() => {
                setDone(null);
                searchRef.current?.focus();
              }}
              data-testid="new-sale"
            >
              {t("newSale")} <Kbd>Enter</Kbd>
            </Button>
          </>
        }
      >
        {done ? (
          <div className="flex flex-col items-center gap-3">
            {done.change ? (
              <p className="text-2xl font-bold text-success" data-testid="sale-change">
                {t("change")}: {m(done.change)}
              </p>
            ) : null}
            <div className="print-area max-h-[50vh] overflow-y-auto rounded border border-border">
              <ReceiptView model={done.receipt} width={p.settings.receipt.paperWidthMm} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function EmailReceiptButton({ saleId, defaultEmail }: { saleId: string; defaultEmail: string }) {
  const t = useTranslations("register");
  const engine = useEngine();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t("emailReceipt")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("emailReceipt")} size="sm">
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await engine?.flush(true);
            const res = await emailReceipt(saleId, email);
            setBusy(false);
            if (!res.ok) return toast.error(res.error);
            toast.success(res.data.delivered ? "Receipt sent" : "Receipt queued (no mail server configured)");
            setOpen(false);
          }}
        >
          <Field label="Email" htmlFor="receipt-email">
            <Input id="receipt-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy}>
            Send
          </Button>
        </form>
      </Dialog>
    </>
  );
}
