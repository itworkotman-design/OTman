import { prisma } from "@/lib/db";

// The web-sales sales-document series: every Stripe payment receipt
// (paymentReceipts.ts) and refund credit note (refundCreditNotes.ts) gets the
// next number, shown with the W- prefix so it can't be mixed up with
// PowerOffice's own invoice numbers. The ReceiptNumber table is the series:
// the number is its key, so a race can't hand one number out twice, and a
// number is only taken together with its document, so there are no gaps.

export { RECEIPT_SERIES_PREFIX, formatReceiptNumber } from "./receiptSeries";

export type ReceiptNumberTarget = { orderPaymentId: string } | { orderRefundId: string };

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === "P2002";

// Mirrors the number onto the document row (OrderPayment / OrderRefund), which
// the UI and the PDF read.
async function writeOnDocument(target: ReceiptNumberTarget, number: number) {
  if ("orderPaymentId" in target) {
    await prisma.orderPayment.updateMany({ where: { id: target.orderPaymentId }, data: { receiptNumber: number } });
  } else {
    await prisma.orderRefund.updateMany({ where: { id: target.orderRefundId }, data: { receiptNumber: number } });
  }
}

// The document's number: the one it already has, else the next in the series.
export async function allocateReceiptNumber(target: ReceiptNumberTarget): Promise<number> {
  const existing = await prisma.receiptNumber.findUnique({ where: target, select: { number: true } });
  if (existing) {
    await writeOnDocument(target, existing.number);
    return existing.number;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { _max } = await prisma.receiptNumber.aggregate({ _max: { number: true } });
    const next = (_max.number ?? 0) + 1;
    try {
      await prisma.receiptNumber.create({ data: { number: next, ...target } });
      await writeOnDocument(target, next);
      return next;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Either the number was just taken (try the next one) or a parallel
      // call already numbered this same document (use that).
      const raced = await prisma.receiptNumber.findUnique({ where: target, select: { number: true } });
      if (raced) {
        await writeOnDocument(target, raced.number);
        return raced.number;
      }
    }
  }
  throw new Error("Could not assign a receipt number");
}
