"use client";
import { Button, Dialog, Field, Input, Select } from "@unipos/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { startStocktakeAction } from "../actions";

export function StartStocktake({ categories }: { categories: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)}>Start stocktake</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Start stocktake" size="sm">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => startStocktakeAction(String(fd.get("category") || "") || null, String(fd.get("note") ?? "")), {
              onOk: (id) => router.push(`/inventory/stocktakes/${id}`),
            });
          }}
        >
          <Field label="Scope" htmlFor="category">
            <Select id="category" name="category" defaultValue="">
              <option value="">All tracked products</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note" htmlFor="st-note">
            <Input id="st-note" name="note" />
          </Field>
          <Button type="submit" loading={pending}>
            Start
          </Button>
        </form>
      </Dialog>
    </>
  );
}
