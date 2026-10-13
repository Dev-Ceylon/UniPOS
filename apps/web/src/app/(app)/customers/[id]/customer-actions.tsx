"use client";
import { Button, Dialog, Field, Input } from "@unipos/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { adjustPoints, eraseCustomerAction } from "../actions";

export function PrivacyActions({ id }: { id: string }) {
  const { run, pending } = useAction();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <a
        href={`/api/v1/customers/${id}/export`}
        className="inline-flex h-10 items-center rounded-[var(--radius)] border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2"
      >
        Export data
      </a>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Erase
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Erase personal data" size="sm">
        <p className="text-sm">
          This removes the name, phone, email, notes and loyalty history. Sales stay in your records without the customer link. This cannot be undone.
        </p>
        <Button
          className="mt-4 w-full"
          variant="danger"
          loading={pending}
          onClick={() => run(() => eraseCustomerAction(id), { success: "Customer erased", onOk: () => router.push("/customers") })}
        >
          Erase permanently
        </Button>
      </Dialog>
    </>
  );
}

export function PointsAdjust({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Adjust
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Adjust points" size="sm">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => adjustPoints(customerId, Number(fd.get("points")), String(fd.get("reason"))), { success: "Points adjusted", onOk: () => setOpen(false) });
          }}
        >
          <Field label="Points (+/−)" htmlFor="pts">
            <Input id="pts" name="points" type="number" required />
          </Field>
          <Field label="Reason" htmlFor="pts-reason">
            <Input id="pts-reason" name="reason" required minLength={2} />
          </Field>
          <Button type="submit" loading={pending}>
            Save
          </Button>
        </form>
      </Dialog>
    </>
  );
}
