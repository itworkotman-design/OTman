-- CreateTable
CREATE TABLE "PendingQuoteAttachment" (
    "id" TEXT NOT NULL,
    "quoteToken" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingQuoteAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingQuoteAttachment_quoteToken_createdAt_idx" ON "PendingQuoteAttachment"("quoteToken", "createdAt");
