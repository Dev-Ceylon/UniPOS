import { PageHeader } from "@unipos/ui";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { formOptions } from "../load";
import { ProductForm } from "../product-form";

export const metadata = { title: "New product" };

export default async function NewProduct() {
  const ctx = await requireContext("products.edit");
  const opts = await read(ctx, (tx) => formOptions(ctx, tx));
  return (
    <div>
      <PageHeader title="New product" />
      <ProductForm
        currency={ctx.currency}
        {...opts}
        customFieldDefs={ctx.settings.customFields.product}
        canDelete={false}
        initial={{
          id: null,
          name: "",
          description: "",
          categoryId: "",
          taxClassId: opts.taxClasses[0]?.id ?? "",
          type: "standard",
          unit: "each",
          trackStock: ctx.settings.trackStockByDefault,
          favourite: false,
          imageUrl: "",
          modifierGroupIds: [],
          customFields: {},
          variants: [{ name: "", sku: "", barcode: "", price: "", cost: "", opening: "" }],
        }}
      />
    </div>
  );
}
