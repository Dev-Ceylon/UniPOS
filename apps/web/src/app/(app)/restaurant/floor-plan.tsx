"use client";
import { Badge, Button, Card, cn, Dialog, Field, Input, Select } from "@unipos/ui";
import { useRef, useState } from "react";
import { useAction } from "@/components/use-action";
import { deleteTable, moveTable, saveTable } from "./actions";

type T = { id: string; name: string; seats: number; area: string; shape: string; x: number; y: number; occupied: boolean; covers: number };

export function FloorPlan({ tables }: { tables: T[] }) {
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>(Object.fromEntries(tables.map((t) => [t.id, { x: t.x, y: t.y }])));
  const [edit, setEdit] = useState<T | "new" | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const { run, pending } = useAction();
  const areas = [...new Set(tables.map((t) => t.area))];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEdit("new")}>Add table</Button>
        <span className="text-sm text-muted">
          {tables.length} tables · {tables.filter((t) => t.occupied).length} occupied · areas: {areas.join(", ") || "—"}
        </span>
      </div>
      <Card
        className="relative h-[480px] overflow-auto bg-surface-2"
        onPointerMove={(e) => {
          if (!drag.current) return;
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          drag.current.moved = true;
          const id = drag.current.id;
          setPos((p) => ({ ...p, [id]: { x: e.clientX - rect.left - drag.current!.dx, y: e.clientY - rect.top - drag.current!.dy } }));
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (d?.moved) run(() => moveTable(d.id, pos[d.id]!.x, pos[d.id]!.y), { refresh: false });
        }}
        role="application"
        aria-label="Floor plan editor. Use the table list below for keyboard editing."
      >
        {tables.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              "absolute flex touch-none select-none flex-col items-center justify-center border-2 text-sm font-semibold shadow-sm",
              t.shape === "round" ? "h-20 w-20 rounded-full" : t.shape === "long" ? "h-16 w-36 rounded-lg" : "h-20 w-20 rounded-lg",
              t.occupied ? "border-warning bg-warning-soft text-warning" : "border-border bg-surface",
            )}
            style={{ left: pos[t.id]?.x ?? 0, top: pos[t.id]?.y ?? 0 }}
            onPointerDown={(e) => {
              const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
              drag.current = { id: t.id, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
            }}
            onClick={() => {
              if (!drag.current?.moved) setEdit(t);
            }}
          >
            {t.name}
            <span className="text-xs font-normal">{t.occupied ? `${t.covers || "?"} guests` : `${t.seats} seats`}</span>
          </button>
        ))}
      </Card>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {tables.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded border border-border bg-surface px-3 py-2 text-left text-sm"
              onClick={() => setEdit(t)}
            >
              <span>
                {t.name} · {t.area}
              </span>
              {t.occupied ? <Badge tone="warning">Occupied</Badge> : <Badge>{t.seats} seats</Badge>}
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Add table" : `Table ${edit?.name ?? ""}`} size="sm">
        {edit ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(
                () =>
                  saveTable(edit === "new" ? null : edit.id, {
                    name: fd.get("name"),
                    seats: Number(fd.get("seats")),
                    area: fd.get("area"),
                    shape: fd.get("shape"),
                  }),
                { success: "Saved", onOk: () => setEdit(null) },
              );
            }}
          >
            <Field label="Name" htmlFor="t-name">
              <Input id="t-name" name="name" required defaultValue={edit === "new" ? `T${tables.length + 1}` : edit.name} />
            </Field>
            <Field label="Seats" htmlFor="t-seats">
              <Input id="t-seats" name="seats" type="number" min={1} defaultValue={edit === "new" ? 4 : edit.seats} />
            </Field>
            <Field label="Area" htmlFor="t-area">
              <Input id="t-area" name="area" defaultValue={edit === "new" ? (areas[0] ?? "Main") : edit.area} list="areas" />
              <datalist id="areas">
                {areas.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </Field>
            <Field label="Shape" htmlFor="t-shape">
              <Select id="t-shape" name="shape" defaultValue={edit === "new" ? "square" : edit.shape}>
                <option value="square">Square</option>
                <option value="round">Round</option>
                <option value="long">Long</option>
              </Select>
            </Field>
            <div className="flex justify-between">
              {edit !== "new" ? (
                <Button
                  variant="ghost"
                  className="text-danger"
                  onClick={() => confirm("Delete table?") && run(() => deleteTable(edit.id), { onOk: () => setEdit(null) })}
                >
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" loading={pending}>
                Save
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
