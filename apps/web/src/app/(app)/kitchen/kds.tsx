"use client";
import { Badge, Button, Card, cn } from "@unipos/ui";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { bumpTicket } from "../restaurant/actions";

type Ticket = { id: string; number: number; tableName: string | null; course: number; status: string; createdAt: string; items: { name: string; qty: number; modifiers: string[]; note: string | null }[] };

const NEXT: Record<string, "in_progress" | "ready" | "bumped"> = { new: "in_progress", in_progress: "ready", ready: "bumped" };
const LABEL: Record<string, string> = { new: "Start", in_progress: "Ready", ready: "Bump" };

function age(iso: string, now: number) {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  return mins < 1 ? "now" : `${mins} min`;
}

/** Kitchen display with a bump screen. Polls every 4 s; tickets turn red after 15 minutes. */
export function KitchenDisplay() {
  const [open, setOpen] = useState<Ticket[]>([]);
  const [recent, setRecent] = useState<Ticket[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/kitchen", { cache: "no-store" });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setOpen(data.open);
      setRecent(data.recent);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setNow(Date.now());
  }, []);
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, [load]);
  const step = async (t: Ticket, status: "in_progress" | "ready" | "bumped" | "new") => {
    setOpen((o) => (status === "bumped" ? o.filter((x) => x.id !== t.id) : o.map((x) => (x.id === t.id ? { ...x, status } : x))));
    const res = await bumpTicket(t.id, status);
    if (!res.ok) toast.error(res.error);
    void load();
  };
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col gap-3 bg-bg p-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Kitchen</h1>
        <Badge tone="warning">{open.filter((t) => t.status === "new").length} new</Badge>
        <Badge tone="primary">{open.filter((t) => t.status === "in_progress").length} cooking</Badge>
        <Badge tone="success">{open.filter((t) => t.status === "ready").length} ready</Badge>
        {error ? <Badge tone="danger">{error}</Badge> : null}
        {recent[0] ? (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => step(recent[0]!, "ready")}>
            Recall #{recent[0].number}
          </Button>
        ) : null}
      </div>
      <div className="grid flex-1 auto-rows-min grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-live="polite">
        {open.map((t) => {
          const late = now - new Date(t.createdAt).getTime() > 15 * 60_000;
          return (
            <Card key={t.id} className={cn("flex flex-col", late && t.status !== "ready" && "border-danger ring-2 ring-danger/40", t.status === "ready" && "border-success")}>
              <div className={cn("flex items-center justify-between rounded-t-lg px-3 py-2 text-sm font-semibold", t.status === "new" ? "bg-warning-soft" : t.status === "ready" ? "bg-success-soft" : "bg-primary-soft")}>
                <span>
                  #{t.number} · {t.tableName ?? "Takeaway"} · Course {t.course}
                </span>
                <span className={late ? "text-danger" : ""}>{age(t.createdAt, now)}</span>
              </div>
              <ul className="flex-1 px-3 py-2">
                {t.items.map((it, i) => (
                  <li key={i} className="py-1">
                    <span className="text-lg font-semibold">{it.qty}×</span> <span className="text-lg">{it.name}</span>
                    {it.modifiers.length ? <p className="text-sm text-muted">{it.modifiers.join(", ")}</p> : null}
                    {it.note ? <p className="text-sm font-medium text-warning">“{it.note}”</p> : null}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 p-3 pt-0">
                <Button size="lg" className="flex-1" variant={t.status === "ready" ? "success" : "primary"} onClick={() => step(t, NEXT[t.status]!)}>
                  {LABEL[t.status]}
                </Button>
              </div>
            </Card>
          );
        })}
        {!open.length ? <p className="col-span-full py-24 text-center text-lg text-muted">No open tickets</p> : null}
      </div>
    </div>
  );
}
