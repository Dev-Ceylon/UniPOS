"use client";
import type { CustomFieldDef } from "@unipos/core";
import { Button, Checkbox, Dialog, Field, Input, Select, Textarea } from "@unipos/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/use-action";
import { saveCustomer } from "./actions";

export interface CustomerData {
  id: string;
  name: string;
  phone: string;
  email: string;
  group: string;
  notes: string;
  marketingConsent: boolean;
  customFields: Record<string, unknown>;
}

export function CustomerForm({ customer, customFields }: { customer: CustomerData | null; customFields: CustomFieldDef[] }) {
  const [open, setOpen] = useState(false);
  const { run, pending, fieldErrors } = useAction();
  const router = useRouter();
  return (
    <>
      <Button variant={customer ? "outline" : "primary"} onClick={() => setOpen(true)}>
        {customer ? "Edit" : "New customer"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={customer ? `Edit ${customer.name}` : "New customer"}>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const cf = Object.fromEntries(
              customFields.map((d) => [d.key, d.type === "boolean" ? fd.get(`cf_${d.key}`) === "on" : String(fd.get(`cf_${d.key}`) ?? "")]),
            );
            run(
              () =>
                saveCustomer(customer?.id ?? null, {
                  name: fd.get("name"),
                  phone: fd.get("phone"),
                  email: fd.get("email"),
                  group: fd.get("group"),
                  notes: fd.get("notes"),
                  marketingConsent: fd.get("marketingConsent") === "on",
                  customFields: cf,
                }),
              {
                success: "Customer saved",
                onOk: (id) => {
                  setOpen(false);
                  if (!customer) router.push(`/customers/${id}`);
                },
              },
            );
          }}
        >
          <Field label="Name" htmlFor="cu-name" className="sm:col-span-2" error={fieldErrors.name}>
            <Input id="cu-name" name="name" required defaultValue={customer?.name} />
          </Field>
          <Field label="Phone" htmlFor="cu-phone">
            <Input id="cu-phone" name="phone" type="tel" defaultValue={customer?.phone} />
          </Field>
          <Field label="Email" htmlFor="cu-email" error={fieldErrors.email}>
            <Input id="cu-email" name="email" type="email" defaultValue={customer?.email} />
          </Field>
          <Field label="Group" htmlFor="cu-group" hint="e.g. VIP, Wholesale">
            <Input id="cu-group" name="group" defaultValue={customer?.group} />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox name="marketingConsent" defaultChecked={customer?.marketingConsent} label="Agreed to marketing messages" />
          </div>
          {customFields.map((d) =>
            d.type === "boolean" ? (
              <Checkbox key={d.key} name={`cf_${d.key}`} defaultChecked={!!customer?.customFields[d.key]} label={d.label} />
            ) : (
              <Field
                key={d.key}
                label={`${d.label}${d.required ? " *" : ""}`}
                htmlFor={`cf_${d.key}`}
                error={fieldErrors[`customFields.${d.key}`] ?? fieldErrors[d.key]}
              >
                {d.type === "select" ? (
                  <Select id={`cf_${d.key}`} name={`cf_${d.key}`} defaultValue={String(customer?.customFields[d.key] ?? "")}>
                    <option value="">—</option>
                    {(d.options ?? []).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id={`cf_${d.key}`}
                    name={`cf_${d.key}`}
                    type={d.type === "number" ? "number" : d.type === "date" ? "date" : "text"}
                    defaultValue={String(customer?.customFields[d.key] ?? "")}
                  />
                )}
              </Field>
            ),
          )}
          <Field label="Notes" htmlFor="cu-notes" className="sm:col-span-2">
            <Textarea id="cu-notes" name="notes" defaultValue={customer?.notes} />
          </Field>
          <Button type="submit" loading={pending} className="sm:col-span-2">
            Save
          </Button>
        </form>
      </Dialog>
    </>
  );
}
