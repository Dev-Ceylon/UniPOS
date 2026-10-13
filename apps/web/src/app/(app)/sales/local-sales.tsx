"use client";
import { formatMoney } from "@unipos/core";
import { Alert, Button } from "@unipos/ui";
import { useLiveQuery } from "dexie-react-hooks";
import { posDb } from "@/offline/db";
import { useEngine } from "@/offline/provider";

/** Sales on this device that have not reached the server (pending or rejected). */
export function LocalSales({ tenantId, currency }: { tenantId: string; currency: string }) {
  const engine = useEngine();
  const rows = useLiveQuery(() => posDb(tenantId).sales.where("status").anyOf("pending", "rejected").toArray(), [tenantId]);
  if (!rows?.length) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      {rows.map((s) => (
        <Alert key={s.clientId} tone={s.status === "rejected" ? "danger" : "warning"}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>{s.number}</strong> · {formatMoney(s.payload.expected.total, currency)} · {s.status === "rejected" ? `Rejected: ${s.error}` : "Waiting to sync on this device"}
            </span>
            {s.status === "rejected" ? (
              <Button size="sm" variant="outline" onClick={() => engine?.retryRejected(s.clientId)}>
                Retry
              </Button>
            ) : null}
          </div>
        </Alert>
      ))}
    </div>
  );
}
