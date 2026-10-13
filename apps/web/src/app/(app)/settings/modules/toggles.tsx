"use client";
import type { ModuleId, ModuleMeta } from "@unipos/core";
import { Badge, Button, Card } from "@unipos/ui";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { saveModules } from "../actions";

export function ModuleToggles({ modules, enabled }: { modules: (ModuleMeta & { dependsOn: ModuleId[] })[]; enabled: ModuleId[] }) {
  const [on, setOn] = useState(new Set(enabled));
  const { run, pending } = useAction();
  const toggle = (m: ModuleMeta & { dependsOn: ModuleId[] }) => {
    const next = new Set(on);
    if (next.has(m.id)) {
      next.delete(m.id);
      // also turn off modules that depend on this one
      for (const x of modules) if (x.dependsOn.includes(m.id)) next.delete(x.id);
    } else {
      next.add(m.id);
      for (const d of m.dependsOn) next.add(d);
    }
    setOn(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <ul className="divide-y divide-border">
          {modules.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium">
                  {m.name} {m.required ? <Badge>always on</Badge> : null}
                </p>
                <p className="text-sm text-muted">
                  {m.description}
                  {m.dependsOn.length ? ` · needs ${m.dependsOn.map((d) => modules.find((x) => x.id === d)?.name).join(", ")}` : ""}
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center">
                <span className="sr-only">Enable {m.name}</span>
                <input type="checkbox" role="switch" className="peer sr-only" checked={on.has(m.id)} disabled={m.required} onChange={() => toggle(m)} data-testid={`module-${m.id}`} />
                <span className="h-6 w-11 rounded-full bg-border transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:opacity-50 relative after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
              </label>
            </li>
          ))}
        </ul>
      </Card>
      <div>
        <Button loading={pending} onClick={() => run(() => saveModules([...on]), { success: "Modules updated" })} data-testid="save-modules">
          Save modules
        </Button>
      </div>
    </div>
  );
}
