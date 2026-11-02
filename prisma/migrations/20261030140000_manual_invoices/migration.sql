-- Manual faktura payments for homepage orders (lib/orders/manualPayments.ts).
ALTER TABLE "Order" ADD COLUMN "paymentStatus" TEXT;

CREATE INDEX "Order_isWebsiteOrder_paymentStatus_idx" ON "Order"("isWebsiteOrder", "paymentStatus");

CREATE TABLE "OrderInvoice" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'invoice',
    "amountCents" INTEGER NOT NULL,
    "totalAfterCents" INTEGER NOT NULL,
    "orderSnapshot" JSONB NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidByMembershipId" TEXT,
    "pdfKey" TEXT,
    "emailMessageId" TEXT,
    "sentByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderInvoice_orderId_sequence_key" ON "OrderInvoice"("orderId", "sequence");
CREATE INDEX "OrderInvoice_companyId_createdAt_idx" ON "OrderInvoice"("companyId", "createdAt");

ALTER TABLE "OrderInvoice" ADD CONSTRAINT "OrderInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
