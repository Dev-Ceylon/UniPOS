"use client";
import type { CustomFieldDef } from "@unipos/core";
import { Button, Card, CardBody, CardHeader, CardTitle, Checkbox, Input, Select } from "@unipos/ui";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { saveCustomFields } from "../actions";

export function CustomFieldsEditor({ entity, initial }: { entity: "product" | "customer"; initial: CustomFieldDef[] }) {
  const [defs, setDefs] = useState(initial.map((d) => ({ ...d, optionsText: (d.options ?? []).join(", ") })));
  const { run, pending } = useAction();
  const set = (i: number, patch: Partial<(typeof defs)[number]>) => setDefs((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize">{entity} fields</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setDefs([...defs, { key: "", label: "", type: "text", required: false, optionsText: "" }])}>
          <Plus className="h-4 w-4" /> Field
        </Button>
      </CardHeader>
      <CardBody className="flex flex-col gap-2">
        {defs.map((d, i) => (
          <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_8rem_1fr_auto_auto]">
            <Input aria-label="Label" placeholder="Label" value={d.label} onChange={(e) => set(i, { label: e.target.value, key: d.key || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) })} />
            <Input aria-label="Key" placeholder="key" value={d.key} onChange={(e) => set(i, { key: e.target.value })} />
            <Select aria-label="Type" value={d.type} onChange={(e) => set(i, { type: e.target.value as CustomFieldDef["type"] })}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Yes/No</option>
              <option value="date">Date</option>
              <option value="select">Choice</option>
            </Select>
            <Input aria-label="Options" placeholder={d.type === "select" ? "Options, comma separated" : "—"} disabled={d.type !== "select"} value={d.optionsText} onChange={(e) => set(i, { optionsText: e.target.value })} />
            <Checkbox label="Required" checked={d.required} onChange={(e) => set(i, { required: e.target.checked })} />
            <Button size="icon" variant="ghost" aria-label="Remove field" onClick={() => setDefs(defs.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {!defs.length ? <p className="text-sm text-muted">No custom fields.</p> : null}
        <div>
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              run(
                () =>
                  saveCustomFields(
                    entity,
                    defs.map(({ optionsText, ...d }) => ({ ...d, options: d.type === "select" ? optionsText.split(",").map((s) => s.trim()).filter(Boolean) : undefined })),
                  ),
                { success: "Fields saved" },
              )
            }
          >
            Save
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
