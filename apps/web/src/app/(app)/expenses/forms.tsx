"use client";
import { Button, Dialog, Field, Input } from "@unipos/ui";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { addExpense, deleteExpense } from "./actions";

const DEFAULTS = ["Rent", "Utilities", "Salaries", "Supplies", "Transport", "Maintenance", "Marketing", "Other"];

export function NewExpense({ currency, categories }: { currency: string; categories: string[] }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  const cats = [...new Set([...categories, ...DEFAULTS])];
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add expense</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add expense" size="sm">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            run(() => addExpense(Object.fromEntries(new FormData(form))), { success: "Expense added", onOk: () => setOpen(false) });
          }}
        >
          <Field label="Category" htmlFor="ex-cat">
            <Input id="ex-cat" name="category" list="ex-cats" required />
            <datalist id="ex-cats">
              {cats.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Description" htmlFor="ex-desc">
            <Input id="ex-desc" name="description" required />
          </Field>
          <Field label={`Amount (${currency})`} htmlFor="ex-amt">
            <Input id="ex-amt" name="amount" inputMode="decimal" required />
          </Field>
          <Field label="Date" htmlFor="ex-date">
            <Input id="ex-date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Reference" htmlFor="ex-ref">
            <Input id="ex-ref" name="reference" placeholder="Invoice / bill number" />
          </Field>
          <Button type="submit" loading={pending}>
            Save
          </Button>
        </form>
      </Dialog>
    </>
  );
}

export function DeleteExpense({ id }: { id: string }) {
  const { run } = useAction();
  return (
    <Button size="icon" variant="ghost" aria-label="Delete expense" onClick={() => confirm("Delete this expense?") && run(() => deleteExpense(id), { success: "Deleted" })}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
