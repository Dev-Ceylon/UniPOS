"use client";
import { formatMoney } from "@unipos/core";
import { Alert, Button, Field, Input, Select, Textarea } from "@unipos/ui";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { cashMove, closeShiftForm, openShiftForm } from "./actions";

export function OpenShift({ currency }: { currency: string }) {
  const { run, pending } = useAction();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => openShiftForm(String(new FormData(e.currentTarget).get("float"))), { success: "Shift opened" });
      }}
    >
      <h2 className="font-semibold">Open a shift</h2>
      <Field label={`Opening float (${currency})`} htmlFor="float">
        <Input id="float" name="float" inputMode="decimal" defaultValue="0" />
      </Field>
      <Button type="submit" loading={pending}>
        Open shift
      </Button>
    </form>
  );
}

export function CashUp({ shiftId, currency, denominations, expected }: { shiftId: string; currency: string; denominations: number[]; expected: number }) {
  const { run, pending } = useAction();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ expected: number; counted: number | null; variance: number } | null>(null);
  const counted = Object.entries(counts).reduce((a, [d, n]) => a + Number(d) * n, 0);
  const m = (v: number) => formatMoney(v, currency);
  return (
    <div className="flex flex-col gap-6">
      <form
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const form = e.currentTarget;
          run(() => cashMove(shiftId, fd.get("type") as "in" | "out", String(fd.get("amount")), String(fd.get("reason"))), { success: "Recorded", onOk: () => form.reset() });
        }}
      >
        <Select name="type" aria-label="Cash in or out">
          <option value="out">Cash out</option>
          <option value="in">Cash in</option>
        </Select>
        <Input name="amount" aria-label="Amount" inputMode="decimal" placeholder="Amount" required />
        <Input name="reason" aria-label="Reason" placeholder="Reason" required />
        <Button type="submit" variant="outline" loading={pending}>
          Record
        </Button>
      </form>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => closeShiftForm(shiftId, counts, String(new FormData(e.currentTarget).get("note") ?? "")), { success: "Shift closed", onOk: setResult });
        }}
      >
        <h3 className="text-sm font-semibold">Count the drawer</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {denominations.map((d) => (
            <label key={d} className="flex items-center justify-between gap-2 text-sm">
              <span className="tabular w-20">{m(d)}</span>
              <Input
                type="number"
                min={0}
                aria-label={`Count of ${m(d)}`}
                className="h-9 w-20"
                value={counts[d] ?? ""}
                onChange={(e) => setCounts((c) => ({ ...c, [d]: Math.max(0, Number(e.target.value) || 0) }))}
              />
            </label>
          ))}
        </div>
        <div className="flex justify-between rounded bg-surface-2 p-3 text-sm">
          <span>
            Counted <strong className="tabular">{m(counted)}</strong>
          </span>
          <span>
            Variance <strong className={`tabular ${counted - expected < 0 ? "text-danger" : "text-success"}`}>{m(counted - expected)}</strong>
          </span>
        </div>
        <Field label="Note" htmlFor="note">
          <Textarea id="note" name="note" maxLength={500} />
        </Field>
        <Button type="submit" loading={pending} data-testid="close-shift">
          Close shift
        </Button>
        {result ? (
          <Alert tone={result.variance === 0 ? "success" : "warning"}>
            Closed. Expected {m(result.expected)}, counted {m(result.counted ?? 0)}, variance {m(result.variance)}.
          </Alert>
        ) : null}
      </form>
    </div>
  );
}
