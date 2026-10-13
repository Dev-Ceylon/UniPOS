"use client";
import type { SalePayload, SyncOpResult, TaxRule } from "@unipos/core";
import Dexie, { type EntityTable } from "dexie";

/** Catalog entry per sellable variant, cached per location for offline selling. */
export interface CachedProduct {
  id: string; // variantId
  productId: string;
  name: string;
  variantName: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost: number;
  categoryId: string | null;
  categoryName: string | null;
  taxRules: TaxRule[];
  favourite: number; // 1/0 (indexable)
  trackStock: boolean;
  type: string;
  onHand: number | null;
  modifierGroupIds: string[];
  imageUrl: string | null;
}
export interface CachedCategory {
  id: string;
  name: string;
  sortOrder: number;
  color: string | null;
}
export interface CachedModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: { name: string; priceDelta: number }[];
}
export interface CachedCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  points: number;
}
export interface LocalSale {
  clientId: string;
  number: string;
  createdAt: string;
  status: "pending" | "synced" | "rejected";
  payload: SalePayload;
  receipt: unknown;
  error?: string;
  flags?: string[];
}
export interface OutboxOp {
  opId: string;
  type: "sale.create" | "cash.movement";
  payload: unknown;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}
export interface HeldCart {
  id: string;
  label: string;
  createdAt: string;
  cart: unknown;
}
export interface MetaRow {
  key: string;
  value: unknown;
}

export type PosDB = Dexie & {
  products: EntityTable<CachedProduct, "id">;
  categories: EntityTable<CachedCategory, "id">;
  modifierGroups: EntityTable<CachedModifierGroup, "id">;
  customers: EntityTable<CachedCustomer, "id">;
  sales: EntityTable<LocalSale, "clientId">;
  outbox: EntityTable<OutboxOp, "opId">;
  held: EntityTable<HeldCart, "id">;
  meta: EntityTable<MetaRow, "key">;
};

const dbs = new Map<string, PosDB>();

/** One IndexedDB per tenant so a shared device never mixes shops. */
export function posDb(tenantId: string): PosDB {
  let db = dbs.get(tenantId);
  if (db) return db;
  db = new Dexie(`unipos_${tenantId}`) as PosDB;
  db.version(1).stores({
    products: "id, productId, barcode, sku, categoryId, favourite, name",
    categories: "id, sortOrder",
    modifierGroups: "id",
    customers: "id, name, phone",
    sales: "clientId, status, createdAt, number",
    outbox: "opId, createdAt, nextAttemptAt",
    held: "id, createdAt",
    meta: "key",
  });
  dbs.set(tenantId, db);
  return db;
}

export async function getMeta<T>(db: PosDB, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}
export async function setMeta(db: PosDB, key: string, value: unknown) {
  await db.meta.put({ key, value });
}

export type SyncResultHandler = (r: SyncOpResult) => void;
