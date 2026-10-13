"use client";
import { Button, Card, CardBody, CardHeader, Checkbox, Input } from "@unipos/ui";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { deleteTaxClass, saveTaxClass } from "../actions";

type Rule = { id?: string; name: string; rate: string; inclusive: boolean; compound: boolean; region: string; priority: number };
type Cls = { id: string | null; name: string; rules: Rule[] };

function ClassCard({ cls }: { cls: Cls }) {
  const [c, setC] = useState(cls);
  const { run, pending } = useAction();
  const setRule = (i: number, patch: Partial<Rule>) => setC((x) => ({ ...x, rules: x.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              saveTaxClass(c.id, {
                name: c.name,
                rules: c.rules.map((r) => ({ id: r.id, name: r.name, rateBp: Math.round(Number(r.rate) * 100), inclusive: r.inclusive, compound: r.compound, region: r.region, priority: r.priority })),
              }),
            { success: "Tax class saved", onOk: () => !c.id && setC({ id: null, name: "", rules: [] }) },
          );
        }}
      >
        <CardHeader>
          <Input aria-label="Tax class name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="New tax class" required className="max-w-xs font-semibold" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setC({ ...c, rules: [...c.rules, { name: "", rate: "", inclusive: true, compound: false, region: "", priority: c.rules.length }] })}>
              <Plus className="h-4 w-4" /> Rule
            </Button>
            {c.id ? (
              <Button size="sm" variant="ghost" aria-label="Delete tax class" onClick={() => confirm("Delete this tax class?") && run(() => deleteTaxClass(c.id!), { success: "Deleted" })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardBody className="flex flex-col gap-2">
          {c.rules.map((r, i) => (
            <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_6rem_8rem_auto_auto_3rem_auto]">
              <Input aria-label="Rule name" placeholder="VAT" value={r.name} onChange={(e) => setRule(i, { name: e.target.value })} required />
              <Input aria-label="Rate percent" placeholder="%" inputMode="decimal" value={r.rate} onChange={(e) => setRule(i, { rate: e.target.value })} required />
              <Input aria-label="Region" placeholder="Region (optional)" value={r.region} onChange={(e) => setRule(i, { region: e.target.value })} />
              <Checkbox label="Inclusive" checked={r.inclusive} onChange={(e) => setRule(i, { inclusive: e.target.checked })} />
              <Checkbox label="Compound" checked={r.compound} onChange={(e) => setRule(i, { compound: e.target.checked })} />
              <Input aria-label="Order" type="number" value={r.priority} onChange={(e) => setRule(i, { priority: Number(e.target.value) })} />
              <Button size="icon" variant="ghost" aria-label="Remove rule" onClick={() => setC({ ...c, rules: c.rules.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!c.rules.length ? <p className="text-sm text-muted">No rules: products in this class are not taxed.</p> : null}
          <div>
            <Button type="submit" size="sm" loading={pending}>
              Save
            </Button>
          </div>
        </CardBody>
      </form>
    </Card>
  );
}

export function TaxEditor({ classes }: { classes: Cls[] }) {
  return (
    <div className="flex flex-col gap-4">
      {classes.map((c) => (
        <ClassCard key={c.id} cls={c} />
      ))}
      <ClassCard cls={{ id: null, name: "", rules: [] }} />
    </div>
  );
}
