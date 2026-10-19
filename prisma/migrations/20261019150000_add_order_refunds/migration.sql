-- CreateTable
CREATE TABLE "OrderRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderPaymentId" TEXT NOT NULL,
    "stripeRefundId" TEXT NOT NULL,
    "amountRefundedCents" INTEGER NOT NULL,
    "reason" TEXT,
    "orderSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderRefund_stripeRefundId_key" ON "OrderRefund"("stripeRefundId");

-- CreateIndex
CREATE INDEX "OrderRefund_orderId_createdAt_idx" ON "OrderRefund"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderRefund_orderPaymentId_idx" ON "OrderRefund"("orderPaymentId");

-- AddForeignKey
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_orderPaymentId_fkey" FOREIGN KEY ("orderPaymentId") REFERENCES "OrderPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
