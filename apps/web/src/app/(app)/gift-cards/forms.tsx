"use client";
import { Alert, Button, Dialog, Field, Input } from "@unipos/ui";
import { useState } from "react";
import { Barcode } from "@/components/barcode";
import { useAction } from "@/components/use-action";
import { issueGiftCardAction, toggleGiftCard } from "./actions";

export function IssueGiftCard({ currency }: { currency: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const { run, pending } = useAction();
  return (
    <>
      <Button
        onClick={() => {
          setCode(null);
          setOpen(true);
        }}
      >
        Issue gift card
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Issue gift card" size="sm">
        {code ? (
          <div className="flex flex-col items-center gap-3">
            <Alert tone="success">Card issued. Take payment for it at the register as an “Other” item if you sell it.</Alert>
            <div className="print-area flex flex-col items-center bg-white p-4 text-black">
              <Barcode value={code} />
            </div>
            <Button onClick={() => window.print()}>Print</Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() => issueGiftCardAction({ value: String(fd.get("value")), code: String(fd.get("code") ?? ""), customerId: "", expiresAt: String(fd.get("expiresAt") ?? "") }), { onOk: setCode, success: "Gift card issued" });
            }}
          >
            <Field label={`Value (${currency})`} htmlFor="gc-value">
              <Input id="gc-value" name="value" inputMode="decimal" required />
            </Field>
            <Field label="Code" htmlFor="gc-code" hint="Leave empty to generate a scannable code">
              <Input id="gc-code" name="code" />
            </Field>
            <Field label="Expires" htmlFor="gc-exp">
              <Input id="gc-exp" name="expiresAt" type="date" />
            </Field>
            <Button type="submit" loading={pending}>
              Issue
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

export function GiftCardToggle({ id, active }: { id: string; active: boolean }) {
  const { run, pending } = useAction();
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => toggleGiftCard(id, !active))}>
      {active ? "Deactivate" : "Activate"}
    </Button>
  );
}
