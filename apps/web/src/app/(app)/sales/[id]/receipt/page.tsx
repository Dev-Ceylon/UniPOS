import { notFound } from "next/navigation";
import { ReceiptView } from "@/components/receipt-view";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { receiptModel } from "@/lib/receipts";
import { PrintButton } from "./print-button";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("sales.view");
  const { id } = await params;
  const model = await read(ctx, (tx) => receiptModel(ctx, tx, id));
  if (!model) notFound();
  return (
    <div className="flex flex-col items-center gap-4">
      <PrintButton />
      <div className="print-area rounded border border-border shadow-sm">
        <ReceiptView model={model} width={ctx.settings.receipt.paperWidthMm} />
      </div>
    </div>
  );
}
