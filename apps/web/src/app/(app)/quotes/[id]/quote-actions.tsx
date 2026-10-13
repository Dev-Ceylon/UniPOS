"use client";
import { Button } from "@unipos/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { emptyCart, type CartLine } from "@/components/register/cart";
import { useAction } from "@/components/use-action";
import { setQuoteStatus } from "../actions";

export function QuoteActions({
  tenantId,
  locationId,
  quote,
}: {
  tenantId: string;
  locationId: string;
  quote: { id: string; status: string; saleId: string | null; customerId: string | null; customerName: string | null; lines: unknown[] };
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  return (
    <>
      <Button variant="outline" onClick={() => window.print()}>
        Print / PDF
      </Button>
      {quote.status === "draft" ? (
        <Button variant="outline" loading={pending} onClick={() => run(() => setQuoteStatus(quote.id, "sent"))}>
          Mark sent
        </Button>
      ) : null}
      {quote.saleId ? (
        <Link
          className="inline-flex h-10 items-center rounded-[var(--radius)] bg-primary px-4 text-sm font-medium text-primary-fg"
          href={`/sales/${quote.saleId}`}
        >
          View sale
        </Link>
      ) : (
        <Button
          onClick={() => {
            // Load the quote into the register cart; the sale links back to the quote on sync.
            const cart = {
              ...emptyCart(),
              lines: quote.lines as CartLine[],
              customerId: quote.customerId,
              customerName: quote.customerName,
              quoteId: quote.id,
            };
            localStorage.setItem(`unipos_cart_${tenantId}_${locationId}`, JSON.stringify(cart));
            router.push("/register");
          }}
        >
          Convert to sale
        </Button>
      )}
    </>
  );
}
