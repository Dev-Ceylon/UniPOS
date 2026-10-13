import type { Tx } from "../client";

/** Atomically increment a per-tenant counter and return the new value. */
export async function nextCounter(tx: Tx, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("tenantId", "key", "value")
    VALUES (unipos_current_tenant(), ${key}, 1)
    ON CONFLICT ("tenantId", "key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return Number(rows[0]!.value);
}

export async function nextNumber(tx: Tx, key: string, prefix: string, width = 5): Promise<string> {
  const n = await nextCounter(tx, key);
  return `${prefix}-${String(n).padStart(width, "0")}`;
}
