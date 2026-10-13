"use client";
import { Button, Card, CardBody, Field, Select } from "@unipos/ui";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { saveTheme } from "../actions";

const SWATCHES = ["#1877F2", "#0F766E", "#7C3AED", "#C2410C", "#BE123C", "#15803D", "#1F2937"];

/** Contrast ratio of white text on the colour (WCAG). */
function contrastWithWhite(hex: string) {
  const c = hex.replace("#", "").match(/.{2}/g)!.map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  return 1.05 / (l + 0.05);
}

export function ThemeForm({ initial }: { initial: { primary: string; radius: string } }) {
  const [primary, setPrimary] = useState(initial.primary);
  const [radius, setRadius] = useState(initial.radius);
  const { run, pending } = useAction();
  const ratio = /^#[0-9a-fA-F]{6}$/.test(primary) ? contrastWithWhite(primary) : 0;
  return (
    <Card className="max-w-xl">
      <CardBody className="flex flex-col gap-4">
        <Field label="Brand colour" htmlFor="th-primary" hint={ratio ? `Contrast with white text ${ratio.toFixed(1)}:1 ${ratio >= 4.5 ? "(meets WCAG AA)" : "(below 4.5:1 — choose a darker colour)"}` : undefined}>
          <div className="flex items-center gap-2">
            <input id="th-primary" type="color" value={primary} onChange={(e) => setPrimary(e.target.value.toUpperCase())} className="h-10 w-16 rounded border border-border" />
            <code className="text-sm">{primary}</code>
          </div>
        </Field>
        <div className="flex gap-2">
          {SWATCHES.map((s) => (
            <button key={s} type="button" aria-label={`Use ${s}`} className="h-8 w-8 rounded-full border-2 border-surface ring-1 ring-border" style={{ background: s }} onClick={() => setPrimary(s)} />
          ))}
        </div>
        <Field label="Corner radius" htmlFor="th-radius">
          <Select id="th-radius" value={radius} onChange={(e) => setRadius(e.target.value)} className="w-40">
            <option value="none">Square</option>
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </Select>
        </Field>
        <div className="flex items-center gap-3">
          <span className="rounded px-4 py-2 font-medium text-white" style={{ background: primary }}>
            Preview button
          </span>
          <Button loading={pending} disabled={ratio < 3} onClick={() => run(() => saveTheme({ primary, radius }), { success: "Theme saved" })}>
            Save theme
          </Button>
          <Button variant="ghost" onClick={() => setPrimary("#1877F2")}>
            Reset to Classic Blue
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
