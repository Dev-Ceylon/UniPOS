"use client";
import { backoffMs, chunk, uuidv7, type CashMovementPayload, type SalePayload, type SyncOpResult } from "@unipos/core";
import { getMeta, posDb, setMeta, type PosDB } from "./db";

export interface SyncState {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  rejected: number;
}

type Listener = (s: SyncState) => void;

/**
 * The outbox runner. Sales are written locally first (so the register never
 * waits on the network) and pushed to the idempotent POST /api/v1/sync.
 */
export class SyncEngine {
  readonly db: PosDB;
  private listeners = new Set<Listener>();
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  state: SyncState = { online: true, pending: 0, syncing: false, lastSyncAt: null, lastError: null, rejected: 0 };

  constructor(
    readonly tenantId: string,
    private fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {
    this.db = posDb(tenantId);
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private emit(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  async refreshCounts() {
    const [pending, rejected, lastSyncAt] = await Promise.all([
      this.db.outbox.count(),
      this.db.sales.where("status").equals("rejected").count(),
      getMeta<string>(this.db, "lastSyncAt"),
    ]);
    this.emit({ pending, rejected, lastSyncAt: lastSyncAt ?? null, online: typeof navigator === "undefined" ? true : navigator.onLine });
  }

  start(intervalMs = 15_000) {
    if (this.timer) return;
    void this.refreshCounts();
    const onOnline = () => {
      this.emit({ online: true });
      void this.flush(true);
    };
    const onOffline = () => this.emit({ online: false });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    this.timer = setInterval(() => void this.flush(), intervalMs);
    void this.flush();
    this.stop = () => {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }

  stop() {}

  async deviceId(): Promise<string> {
    let id = await getMeta<string>(this.db, "deviceId");
    if (!id) {
      id = uuidv7();
      await setMeta(this.db, "deviceId", id);
    }
    return id;
  }

  /** Next receipt number for this device: LOC-DEV-00001 */
  async nextSaleNumber(locationCode: string): Promise<string> {
    const device = (await this.deviceId()).replace(/-/g, "").slice(-4).toUpperCase();
    return this.db.transaction("rw", this.db.meta, async () => {
      const n = ((await getMeta<number>(this.db, "saleSeq")) ?? 0) + 1;
      await setMeta(this.db, "saleSeq", n);
      return `${locationCode}-${device}-${String(n).padStart(5, "0")}`;
    });
  }

  async enqueueSale(payload: SalePayload, receipt: unknown) {
    await this.db.transaction("rw", this.db.sales, this.db.outbox, async () => {
      await this.db.sales.put({ clientId: payload.clientId, number: payload.number, createdAt: payload.createdAt, status: "pending", payload, receipt });
      await this.db.outbox.put({ opId: uuidv7(), type: "sale.create", payload, createdAt: new Date().toISOString(), attempts: 0, nextAttemptAt: 0 });
    });
    await this.refreshCounts();
    void this.flush(true);
  }

  async enqueueCashMovement(payload: CashMovementPayload) {
    await this.db.outbox.put({ opId: uuidv7(), type: "cash.movement", payload, createdAt: new Date().toISOString(), attempts: 0, nextAttemptAt: 0 });
    await this.refreshCounts();
    void this.flush(true);
  }

  /** Push due outbox ops. `force` ignores backoff (used on reconnect / "Sync now"). */
  async flush(force = false): Promise<SyncOpResult[]> {
    if (this.running) return [];
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.emit({ online: false });
      return [];
    }
    this.running = true;
    this.emit({ syncing: true });
    const all: SyncOpResult[] = [];
    try {
      const now = Date.now();
      const ops = (await this.db.outbox.orderBy("createdAt").toArray()).filter((o) => force || o.nextAttemptAt <= now);
      const deviceId = await this.deviceId();
      for (const batch of chunk(ops, 50)) {
        let res: Response;
        try {
          res = await this.fetchImpl("/api/v1/sync", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ deviceId, ops: batch.map((o) => ({ opId: o.opId, type: o.type, payload: o.payload })) }),
            credentials: "same-origin",
          });
        } catch (e) {
          await this.deferBatch(batch, (e as Error).message || "Network error");
          this.emit({ online: false, lastError: "Network error" });
          break;
        }
        if (!res.ok) {
          const msg = res.status === 401 ? "Signed out — sign in to sync" : `Server error ${res.status}`;
          await this.deferBatch(batch, msg);
          this.emit({ lastError: msg });
          break;
        }
        const body = (await res.json()) as { results: SyncOpResult[] };
        all.push(...body.results);
        await this.applyResults(batch, body.results);
        this.emit({ online: true, lastError: null });
      }
      if (ops.length) await setMeta(this.db, "lastSyncAt", new Date().toISOString());
    } finally {
      this.running = false;
      await this.refreshCounts();
      this.emit({ syncing: false });
    }
    return all;
  }

  private async deferBatch(batch: { opId: string; attempts: number }[], error: string) {
    await this.db.transaction("rw", this.db.outbox, async () => {
      for (const o of batch) {
        await this.db.outbox.update(o.opId, { attempts: o.attempts + 1, nextAttemptAt: Date.now() + backoffMs(o.attempts), lastError: error });
      }
    });
  }

  private async applyResults(batch: { opId: string; type: string; payload: unknown }[], results: SyncOpResult[]) {
    const byOp = new Map(results.map((r) => [r.opId, r]));
    await this.db.transaction("rw", this.db.outbox, this.db.sales, async () => {
      for (const o of batch) {
        const r = byOp.get(o.opId);
        if (!r) continue;
        await this.db.outbox.delete(o.opId);
        if (o.type === "sale.create") {
          const clientId = (o.payload as SalePayload).clientId;
          if (r.status === "rejected") await this.db.sales.update(clientId, { status: "rejected", error: r.error });
          else await this.db.sales.update(clientId, { status: "synced", flags: r.flags ?? [] });
        }
      }
    });
  }

  /** Re-queue a rejected sale after the cause was fixed (e.g. product restored). */
  async retryRejected(clientId: string) {
    const sale = await this.db.sales.get(clientId);
    if (!sale || sale.status !== "rejected") return;
    await this.db.transaction("rw", this.db.sales, this.db.outbox, async () => {
      await this.db.sales.update(clientId, { status: "pending", error: undefined });
      await this.db.outbox.put({
        opId: uuidv7(),
        type: "sale.create",
        payload: sale.payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
        nextAttemptAt: 0,
      });
    });
    await this.flush(true);
  }
}

const engines = new Map<string, SyncEngine>();
export function getEngine(tenantId: string): SyncEngine {
  let e = engines.get(tenantId);
  if (!e) {
    e = new SyncEngine(tenantId);
    engines.set(tenantId, e);
  }
  return e;
}
