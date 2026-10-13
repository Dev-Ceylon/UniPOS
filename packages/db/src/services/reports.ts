import type { ReportSale, TaxLine } from "@unipos/core";
import type { Tx } from "../client";

export interface ReportFilter {
  from: Date;
  to: Date;
  locationId?: string | null;
  memberId?: string | null;
}

/** Load sales in a range into the shape the pure report functions take. */
export async function loadReportSales(tx: Tx, f: ReportFilter): Promise<ReportSale[]> {
  const sales = await tx.sale.findMany({
    where: {
      createdAt: { gte: f.from, lt: f.to },
      ...(f.locationId ? { locationId: f.locationId } : {}),
      ...(f.memberId ? { memberId: f.memberId } : {}),
    },
    include: { lines: true, payments: true },
    orderBy: { createdAt: "asc" },
  });
  return sales.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    status: s.status as ReportSale["status"],
    memberName: s.memberName || s.memberId,
    isRefund: s.isRefund,
    total: s.total,
    lines: s.lines.map((l) => ({
      variantId: l.variantId,
      productName: l.name,
      categoryName: l.categoryName,
      qty: l.qty,
      gross: l.gross,
      discount: l.lineDiscount + l.orderDiscount,
      net: l.net,
      taxTotal: l.taxTotal,
      total: l.total,
      unitCost: l.unitCost,
      taxes: l.taxLines as unknown as TaxLine[],
    })),
    payments: s.payments.map((p) => ({ tender: p.tender, amount: p.amount })),
  }));
}
