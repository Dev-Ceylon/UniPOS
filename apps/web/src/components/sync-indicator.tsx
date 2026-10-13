"use client";
import { Badge, Button } from "@unipos/ui";
import { CloudOff, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEngine, useSyncState } from "@/offline/provider";

/** Online/offline status and outbox size; click to sync now. */
export function SyncIndicator() {
  const s = useSyncState();
  const engine = useEngine();
  const t = useTranslations("register");
  const c = useTranslations("common");
  if (!s) return null;
  const label = !s.online ? c("offline") : s.pending ? t("pending", { count: s.pending }) : c("online");
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => engine?.flush(true)}
      title={s.lastError ?? (s.lastSyncAt ? t("lastSync", { time: new Date(s.lastSyncAt).toLocaleTimeString() }) : t("syncNow"))}
      aria-live="polite"
      data-testid="sync-indicator"
    >
      {!s.online ? <CloudOff className="h-4 w-4 text-warning" aria-hidden /> : <RefreshCw className={`h-4 w-4 ${s.syncing ? "animate-spin" : ""}`} aria-hidden />}
      <span className="hidden md:inline">{label}</span>
      {s.pending ? <Badge tone="warning">{s.pending}</Badge> : null}
      {s.rejected ? <Badge tone="danger">{s.rejected}!</Badge> : null}
    </Button>
  );
}
