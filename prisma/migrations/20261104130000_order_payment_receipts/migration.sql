-- Receipts (kvittering) for Stripe payments on homepage orders
-- (lib/invoices/paymentReceipts.ts). Additive only: nullable columns.
ALTER TABLE "OrderPayment" ADD COLUMN "receiptNumber" INTEGER;
ALTER TABLE "OrderPayment" ADD COLUMN "receiptSentAt" TIMESTAMP(3);
ALTER TABLE "OrderPayment" ADD COLUMN "receiptPdfKey" TEXT;

CREATE UNIQUE INDEX "OrderPayment_receiptNumber_key" ON "OrderPayment"("receiptNumber");
