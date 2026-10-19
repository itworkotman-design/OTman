-- CreateTable
CREATE TABLE "OrderPendingChange" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "amountDueCents" INTEGER NOT NULL,
    "expectedTotalIncVat" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stripeCheckoutSessionId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "OrderPendingChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderPendingChange_stripeCheckoutSessionId_key" ON "OrderPendingChange"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "OrderPendingChange_orderId_createdAt_idx" ON "OrderPendingChange"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderPendingChange" ADD CONSTRAINT "OrderPendingChange_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
