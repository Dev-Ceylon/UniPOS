"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { getEngine, type SyncEngine, type SyncState } from "./engine";

const Ctx = createContext<SyncEngine | null>(null);

export function OfflineProvider({ tenantId, children }: { tenantId: string; children: React.ReactNode }) {
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  useEffect(() => {
    const e = getEngine(tenantId);
    e.start();
    setEngine(e);
    return () => e.stop();
  }, [tenantId]);
  return <Ctx.Provider value={engine}>{children}</Ctx.Provider>;
}

export function useEngine() {
  return useContext(Ctx);
}

export function useSyncState(): SyncState | null {
  const engine = useEngine();
  const [s, setS] = useState<SyncState | null>(null);
  useEffect(() => {
    if (!engine) return;
    const unsub = engine.subscribe(setS);
    return () => {
      unsub();
    };
  }, [engine]);
  return s;
}
