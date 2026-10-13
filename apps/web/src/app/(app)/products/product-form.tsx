"use client";
import { parseMoney, type CustomFieldDef } from "@unipos/core";
import { Button, Card, CardBody, CardHeader, CardTitle, Checkbox, Field, Input, Select, Textarea } from "@unipos/ui";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAction } from "@/components/use-action";
import { deleteProductAction, generateBarcode, saveProductAction } from "./actions";

import type { ProductFormData } from "./product-data";

export type { ProductFormData };

export function ProductForm({
  initial,
  currency,
  categories,
  taxClasses,
  modifierGroups,
  customFieldDefs,
  canDelete,
}: {
  initial: ProductFormData;
  currency: string;
  categories: { id: string; name: string }[];
  taxClasses: { id: string; name: string }[];
  modifierGroups: { id: string; name: string }[] | null;
  customFieldDefs: CustomFieldDef[];
  canDelete: boolean;
}) {
  const [f, setF] = useState(initial);
  const { run, pending, fieldErrors } = useAction();
  const router = useRouter();
  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) => setF((x) => ({ ...x, [k]: v }));
  const setVariant = (i: number, patch: Partial<ProductFormData["variants"][number]>) => setF((x) => ({ ...x, variants: x.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));

  const submit = () => {
    let variants;
    try {
      variants = f.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, barcode: v.barcode, price: parseMoney(v.price || "0", currency), cost: parseMoney(v.cost || "0", currency), options: {} }));
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    const opening = Object.fromEntries(f.variants.map((v, i) => [i, Number(v.opening) || 0]));
    run(
      () =>
        saveProductAction(
          f.id,
          {
            name: f.name,
            description: f.description,
            categoryId: f.categoryId || null,
            taxClassId: f.taxClassId || null,
            type: f.type,
            unit: f.unit || "each",
            trackStock: f.trackStock,
            favourite: f.favourite,
            imageUrl: f.imageUrl,
            modifierGroupIds: f.modifierGroupIds,
            customFields: f.customFields,
            variants,
          },
          opening,
        ),
      {
        success: "Product saved",
        onOk: (d) => {
          if (!f.id) router.push(`/products/${d.id}`);
        },
      },
    );
  };

  return (
    <form
      className="grid gap-4 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" className="sm:col-span-2" error={fieldErrors.name}>
              <Input id="name" required value={f.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Description" htmlFor="description" className="sm:col-span-2">
              <Textarea id="description" value={f.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Category" htmlFor="category">
              <Select id="category" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tax class" htmlFor="tax">
              <Select id="tax" value={f.taxClassId} onChange={(e) => set("taxClassId", e.target.value)}>
                <option value="">No tax</option>
                {taxClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type" htmlFor="type">
              <Select id="type" value={f.type} onChange={(e) => set("type", e.target.value as ProductFormData["type"])}>
                <option value="standard">Standard</option>
                <option value="kit">Kit / bundle</option>
                <option value="service">Service (no stock)</option>
              </Select>
            </Field>
            <Field label="Unit" htmlFor="unit">
              <Input id="unit" value={f.unit} onChange={(e) => set("unit", e.target.value)} placeholder="each, kg, box" />
            </Field>
            <Field label="Image URL" htmlFor="imageUrl" className="sm:col-span-2" error={fieldErrors.imageUrl}>
              <Input id="imageUrl" type="url" value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" />
            </Field>
            <div className="flex flex-wrap gap-6 sm:col-span-2">
              <Checkbox label="Track stock" checked={f.trackStock && f.type !== "service"} disabled={f.type === "service"} onChange={(e) => set("trackStock", e.target.checked)} />
              <Checkbox label="Show in register favourites" checked={f.favourite} onChange={(e) => set("favourite", e.target.checked)} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Variants, prices and barcodes</CardTitle>
            <Button size="sm" variant="outline" onClick={() => set("variants", [...f.variants, { name: "", sku: "", barcode: "", price: f.variants[0]?.price ?? "", cost: f.variants[0]?.cost ?? "", opening: "" }])}>
              <Plus className="h-4 w-4" /> Variant
            </Button>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {f.variants.map((v, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
                <Field label="Variant" htmlFor={`v${i}-name`} className="col-span-2 sm:col-span-1">
                  <Input id={`v${i}-name`} value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} placeholder={f.variants.length > 1 ? "Size / colour" : "Default"} />
                </Field>
                <Field label="SKU" htmlFor={`v${i}-sku`}>
                  <Input id={`v${i}-sku`} value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} />
                </Field>
                <Field label="Barcode" htmlFor={`v${i}-barcode`} className="col-span-2 sm:col-span-1">
                  <div className="flex gap-1">
                    <Input id={`v${i}-barcode`} value={v.barcode} onChange={(e) => setVariant(i, { barcode: e.target.value })} />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Generate barcode"
                      onClick={async () => {
                        const res = await generateBarcode();
                        if (res.ok) setVariant(i, { barcode: res.data });
                        else toast.error(res.error);
                      }}
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Field>
                <Field label={`Price (${currency})`} htmlFor={`v${i}-price`}>
                  <Input id={`v${i}-price`} inputMode="decimal" required value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} />
                </Field>
                <Field label="Cost" htmlFor={`v${i}-cost`}>
                  <Input id={`v${i}-cost`} inputMode="decimal" value={v.cost} onChange={(e) => setVariant(i, { cost: e.target.value })} />
                </Field>
                <div className="flex items-end gap-1">
                  {!f.id && f.trackStock ? (
                    <Field label="Opening stock" htmlFor={`v${i}-open`}>
                      <Input id={`v${i}-open`} inputMode="numeric" value={v.opening} onChange={(e) => setVariant(i, { opening: e.target.value })} />
                    </Field>
                  ) : null}
                  {f.variants.length > 1 ? (
                    <Button size="icon" variant="ghost" aria-label="Remove variant" onClick={() => set("variants", f.variants.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
      <div className="flex flex-col gap-4">
        {modifierGroups ? (
          <Card>
            <CardHeader>
              <CardTitle>Modifiers</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-2">
              {modifierGroups.map((g) => (
                <Checkbox
                  key={g.id}
                  label={g.name}
                  checked={f.modifierGroupIds.includes(g.id)}
                  onChange={(e) => set("modifierGroupIds", e.target.checked ? [...f.modifierGroupIds, g.id] : f.modifierGroupIds.filter((x) => x !== g.id))}
                />
              ))}
              {!modifierGroups.length ? <p className="text-sm text-muted">No modifier groups yet.</p> : null}
            </CardBody>
          </Card>
        ) : null}
        {customFieldDefs.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Custom fields</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              {customFieldDefs.map((d) => {
                const val = f.customFields[d.key];
                const setVal = (v: unknown) => set("customFields", { ...f.customFields, [d.key]: v });
                return d.type === "boolean" ? (
                  <Checkbox key={d.key} label={d.label} checked={!!val} onChange={(e) => setVal(e.target.checked)} />
                ) : (
                  <Field key={d.key} label={`${d.label}${d.required ? " *" : ""}`} htmlFor={`cf-${d.key}`} error={fieldErrors[`customFields.${d.key}`] ?? fieldErrors[d.key]}>
                    {d.type === "select" ? (
                      <Select id={`cf-${d.key}`} value={String(val ?? "")} onChange={(e) => setVal(e.target.value)}>
                        <option value="">—</option>
                        {(d.options ?? []).map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </Select>
                    ) : (
                      <Input id={`cf-${d.key}`} type={d.type === "number" ? "number" : d.type === "date" ? "date" : "text"} value={String(val ?? "")} onChange={(e) => setVal(e.target.value)} />
                    )}
                  </Field>
                );
              })}
            </CardBody>
          </Card>
        ) : null}
        <Card>
          <CardBody className="flex flex-col gap-2">
            <Button type="submit" size="lg" loading={pending}>
              Save product
            </Button>
            {f.id && canDelete ? (
              <Button
                variant="ghost"
                className="text-danger"
                onClick={() => {
                  if (confirm("Delete this product? Sales history is kept.")) run(() => deleteProductAction(f.id!), { success: "Deleted", onOk: () => router.push("/products") });
                }}
              >
                Delete product
              </Button>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </form>
  );
}

