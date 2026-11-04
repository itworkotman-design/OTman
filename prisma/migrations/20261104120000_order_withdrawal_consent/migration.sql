-- When a private customer asked for a service on a homepage order to be
-- carried out within the 14-day withdrawal period (angrerettloven § 22 a).
-- Additive only: a nullable column.
ALTER TABLE "Order" ADD COLUMN "withdrawalConsentAt" TIMESTAMP(3);
