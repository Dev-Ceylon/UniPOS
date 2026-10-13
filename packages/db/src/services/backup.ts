import { can, ForbiddenError } from "@unipos/core";
import type { Tx } from "../client";
import { writeAudit } from "./audit";
import type { TenantContext } from "./context";

/**
 * Tables in dependency order (parents first). Backups hold every tenant row;
 * restore replaces the tenant's business data with the backup's.
 */
export const BACKUP_TABLES = [
  "Role", "Location", "Counter", "Category", "TaxClass", "TaxRule", "Product", "Variant", "StockLevel", "StockMovement",
  "Stocktake", "StocktakeLine", "Customer", "Shift", "CashMovement", "Sale", "SaleLine", "Payment", "SyncOp",
  "LoyaltyEntry", "GiftCard", "GiftCardEntry", "Supplier", "PurchaseOrder", "PurchaseOrderLine", "Transfer", "TransferLine",
  "DiningTable", "TableTab", "ModifierGroup", "KitchenTicket", "Quote", "Expense", "AuditLog",
] as const;

export const BACKUP_VERSION = 1;

export interface Backup {
  format: "unipos-backup";
  version: number;
  exportedAt: string;
  tenant: { id: string; name: string; businessType: string; currency: string; locale: string; timezone: string; enabledModules: string[]; settings: unknown; theme: unknown };
  tables: Record<string, Record<string, unknown>[]>;
}

export async function exportBackup(tx: Tx, ctx: TenantContext, tenant: Backup["tenant"]): Promise<Backup> {
  if (!can(ctx.member, "backup.manage")) throw new ForbiddenError("backup.manage");
  const tables: Backup["tables"] = {};
  for (const t of BACKUP_TABLES) {
    // RLS limits this to the current tenant.
    tables[t] = await tx.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM "${t}"`);
  }
  await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "backup.export", "Tenant", ctx.tenantId);
  return { format: "unipos-backup", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tenant, tables };
}

const SELF_REFS: Record<string, string> = { Sale: "originalSaleId", Category: "parentId" };

/** Order rows so a row referencing another row of the same table comes after it. */
function selfRefOrder(table: string, rows: Record<string, unknown>[]) {
  const key = SELF_REFS[table];
  if (!key) return rows;
  const byId = new Map(rows.map((r) => [r.id as string, r]));
  const done = new Set<string>();
  const out: Record<string, unknown>[] = [];
  const visit = (r: Record<string, unknown>, depth = 0) => {
    const id = r.id as string;
    if (done.has(id) || depth > 100) return;
    const parent = r[key] as string | null;
    if (parent && byId.has(parent)) visit(byId.get(parent)!, depth + 1);
    done.add(id);
    out.push(r);
  };
  rows.forEach((r) => visit(r));
  return out;
}

async function columnTypes(tx: Tx, table: string) {
  const rows = await tx.$queryRaw<{ column_name: string; data_type: string; udt_name: string }[]>`
    SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${table}`;
  return new Map(rows.map((r) => [r.column_name, r.data_type === "ARRAY" ? `${r.udt_name.replace(/^_/, "")}[]` : r.udt_name]));
}

/** Replace this tenant's business data with a backup (owner only, audited). */
export async function restoreBackup(tx: Tx, ctx: TenantContext, backup: Backup) {
  if (!can(ctx.member, "backup.manage")) throw new ForbiddenError("backup.manage");
  if (backup?.format !== "unipos-backup" || backup.version !== BACKUP_VERSION) throw new Error("Not a UniPOS backup file");
  for (const t of [...BACKUP_TABLES].reverse()) await tx.$executeRawUnsafe(`DELETE FROM "${t}"`);
  let rows = 0;
  for (const t of BACKUP_TABLES) {
    const data = selfRefOrder(t, backup.tables[t] ?? []);
    if (!data.length) continue;
    const types = await columnTypes(tx, t);
    for (const row of data) {
      const cols = Object.keys(row).filter((c) => types.has(c));
      const values = cols.map((c) => {
        if (c === "tenantId") return ctx.tenantId;
        const v = row[c];
        const ty = types.get(c)!;
        if (v === null || v === undefined) return null;
        if (ty === "jsonb" || ty === "json") return JSON.stringify(v);
        return v;
      });
      const placeholders = cols.map((c, i) => {
        const ty = types.get(c)!;
        return `$${i + 1}::${ty === "timestamp" ? "timestamp(3)" : ty}`;
      });
      await tx.$executeRawUnsafe(`INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders.join(", ")})`, ...values);
      rows++;
    }
  }
  await tx.auditLog.create({ data: { actorId: ctx.member.id, actorName: ctx.member.name, action: "backup.restore", entity: "Tenant", entityId: ctx.tenantId, after: { rows, exportedAt: backup.exportedAt } } });
  return rows;
}

export async function writeAuditSafe(tx: Tx, ctx: TenantContext, action: string) {
  await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, action, "Tenant", ctx.tenantId);
}
