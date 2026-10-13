"use client";
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Textarea } from "@unipos/ui";
import { useAction } from "@/components/use-action";
import { archiveLocation, saveLocation } from "../actions";

type L = { id: string; name: string; code: string; address: string; phone: string; receiptHeader: string; taxRegion: string };

function LocationCard({ l, canEdit, canArchive }: { l: L | null; canEdit: boolean; canArchive: boolean }) {
  const { run, pending, fieldErrors } = useAction();
  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          run(() => saveLocation(l?.id ?? null, Object.fromEntries(new FormData(form))), { success: "Location saved", onOk: () => !l && form.reset() });
        }}
      >
        <CardHeader>
          <CardTitle>{l ? l.name : "Add location"}</CardTitle>
          {l && canEdit && canArchive ? (
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => confirm("Archive this location?") && run(() => archiveLocation(l.id), { success: "Archived" })}>
              Archive
            </Button>
          ) : null}
        </CardHeader>
        <fieldset disabled={!canEdit}>
          <CardBody className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" htmlFor={`ln-${l?.id}`} className="sm:col-span-2">
              <Input id={`ln-${l?.id}`} name="name" defaultValue={l?.name} required />
            </Field>
            <Field label="Code" htmlFor={`lc-${l?.id}`} hint="Used in receipt numbers" error={fieldErrors.code}>
              <Input id={`lc-${l?.id}`} name="code" defaultValue={l?.code} required maxLength={8} onChange={(e) => (e.target.value = e.target.value.toUpperCase())} />
            </Field>
            <Field label="Address" htmlFor={`la-${l?.id}`} className="sm:col-span-2">
              <Textarea id={`la-${l?.id}`} name="address" defaultValue={l?.address} rows={2} />
            </Field>
            <Field label="Phone" htmlFor={`lp-${l?.id}`}>
              <Input id={`lp-${l?.id}`} name="phone" defaultValue={l?.phone} />
            </Field>
            <Field label="Receipt header" htmlFor={`lr-${l?.id}`} className="sm:col-span-2" hint="e.g. VAT registration number">
              <Textarea id={`lr-${l?.id}`} name="receiptHeader" defaultValue={l?.receiptHeader} rows={2} />
            </Field>
            <Field label="Tax region" htmlFor={`lt-${l?.id}`} hint="Matches tax rules with the same region">
              <Input id={`lt-${l?.id}`} name="taxRegion" defaultValue={l?.taxRegion} />
            </Field>
            {canEdit ? (
              <div className="sm:col-span-3">
                <Button type="submit" loading={pending}>
                  Save
                </Button>
              </div>
            ) : null}
          </CardBody>
        </fieldset>
      </form>
    </Card>
  );
}

export function LocationsEditor({ locations, canEdit }: { locations: L[]; canEdit: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {locations.map((l) => (
        <LocationCard key={l.id} l={l} canEdit={canEdit} canArchive={locations.length > 1} />
      ))}
      {canEdit ? <LocationCard l={null} canEdit canArchive={false} /> : null}
    </div>
  );
}
