ALTER TABLE "Order"
ADD COLUMN "contactCustomerForCustomTimeWindow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "customTimeContactNote" TEXT;
