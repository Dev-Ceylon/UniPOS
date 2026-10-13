import { PRODUCT_CSV_COLUMNS } from "@unipos/db";
import { Card, CardBody, PageHeader } from "@unipos/ui";
import { requireContext } from "@/lib/context";
import { ImportForm } from "./form";

export const metadata = { title: "Import products" };

export default async function ImportPage() {
  await requireContext("products.import");
  const template = `${PRODUCT_CSV_COLUMNS.join(",")}\nCeylon Tea 100g,,TEA-100,4790000000017,Tea,450.00,300.00,Standard,yes,24,10,each,yes\n`;
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Import products"
        description="Upload a CSV. Rows are matched by SKU (updated) or created. Rows with the same name become variants of one product. Stock is set at the current location through the ledger."
      />
      <Card className="mb-4">
        <CardBody className="text-sm">
          <p className="mb-2">
            Columns:{" "}
            {PRODUCT_CSV_COLUMNS.map((c) => (
              <code key={c} className="mr-1 rounded bg-surface-2 px-1">
                {c}
              </code>
            ))}
          </p>
          <a
            className="text-primary-ink underline"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`}
            download="unipos-products-template.csv"
          >
            Download template
          </a>
        </CardBody>
      </Card>
      <ImportForm />
    </div>
  );
}
