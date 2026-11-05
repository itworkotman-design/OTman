-- One web-sales document series (W-<n>) shared by Stripe payment receipts and
-- refund credit notes (lib/invoices/receiptNumbers.ts). Additive only.
CREATE TABLE "ReceiptNumber" (
    "number" INTEGER NOT NULL,
    "orderPaymentId" TEXT,
    "orderRefundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptNumber_pkey" PRIMARY KEY ("number")
);

CREATE UNIQUE INDEX "ReceiptNumber_orderPaymentId_key" ON "ReceiptNumber"("orderPaymentId");
CREATE UNIQUE INDEX "ReceiptNumber_orderRefundId_key" ON "ReceiptNumber"("orderRefundId");

-- Receipts already numbered before this series existed keep their numbers.
INSERT INTO "ReceiptNumber" ("number", "orderPaymentId", "createdAt")
SELECT "receiptNumber", "id", COALESCE("receiptSentAt", "createdAt")
FROM "OrderPayment"
WHERE "receiptNumber" IS NOT NULL;

-- Credit notes for Stripe refunds.
ALTER TABLE "OrderRefund" ADD COLUMN "receiptNumber" INTEGER;
ALTER TABLE "OrderRefund" ADD COLUMN "receiptSentAt" TIMESTAMP(3);
ALTER TABLE "OrderRefund" ADD COLUMN "receiptPdfKey" TEXT;

CREATE UNIQUE INDEX "OrderRefund_receiptNumber_key" ON "OrderRefund"("receiptNumber");
