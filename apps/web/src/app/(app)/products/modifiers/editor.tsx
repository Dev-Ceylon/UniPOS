"use client";
import { parseMoney, toDecimalString } from "@unipos/core";
import { Button, Card, CardBody, CardHeader, Field, Input } from "@unipos/ui";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAction } from "@/components/use-action";
import { deleteModifierGroup, saveModifierGroup } from "../actions";

type G = { id: string | null; name: string; minSelect: number; maxSelect: number; modifiers: { name: string; priceDelta: number }[] };

function GroupCard({ group, currency }: { group: G; currency: string }) {
  const [g, setG] = useState({ ...group, mods: group.modifiers.map((m) => ({ name: m.name, price: toDecimalString(m.priceDelta, currency) })) });
  const { run, pending } = useAction();
  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          let modifiers;
          try {
            modifiers = g.mods.map((m) => ({ name: m.name, priceDelta: parseMoney(m.price || "0", currency) }));
          } catch (err) {
            return toast.error((err as Error).message);
          }
          run(() => saveModifierGroup(g.id, { name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, modifiers }), { success: "Saved" });
        }}
      >
        <CardHeader>
          <Input
            aria-label="Group name"
            required
            value={g.name}
            placeholder="New group"
            onChange={(e) => setG({ ...g, name: e.target.value })}
            className="max-w-xs font-semibold"
          />
          {g.id ? (
            <Button size="sm" variant="ghost" aria-label="Delete group" onClick={() => run(() => deleteModifierGroup(g.id!), { success: "Deleted" })}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </CardHeader>
        <CardBody className="flex flex-col gap-2">
          <div className="flex gap-3">
            <Field label="Min" htmlFor={`min-${g.id}`}>
              <Input
                id={`min-${g.id}`}
                type="number"
                min={0}
                value={g.minSelect}
                onChange={(e) => setG({ ...g, minSelect: Number(e.target.value) })}
                className="w-20"
              />
            </Field>
            <Field label="Max" htmlFor={`max-${g.id}`}>
              <Input
                id={`max-${g.id}`}
                type="number"
                min={1}
                value={g.maxSelect}
                onChange={(e) => setG({ ...g, maxSelect: Number(e.target.value) })}
                className="w-20"
              />
            </Field>
          </div>
          {g.mods.map((m, i) => (
            <div key={i} className="flex gap-2">
              <Input
                aria-label="Option name"
                value={m.name}
                required
                onChange={(e) => setG({ ...g, mods: g.mods.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
              />
              <Input
                aria-label="Extra price"
                inputMode="decimal"
                value={m.price}
                onChange={(e) => setG({ ...g, mods: g.mods.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })}
                className="w-32"
              />
              <Button size="icon" variant="ghost" aria-label="Remove option" onClick={() => setG({ ...g, mods: g.mods.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setG({ ...g, mods: [...g.mods, { name: "", price: "0" }] })}>
              <Plus className="h-4 w-4" /> Option
            </Button>
            <Button size="sm" type="submit" loading={pending}>
              Save
            </Button>
          </div>
        </CardBody>
      </form>
    </Card>
  );
}

export function ModifierEditor({ groups, currency }: { groups: G[]; currency: string }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <GroupCard key={g.id} group={g} currency={currency} />
      ))}
      <GroupCard group={{ id: null, name: "", minSelect: 0, maxSelect: 1, modifiers: [{ name: "", priceDelta: 0 }] }} currency={currency} />
    </div>
  );
}
