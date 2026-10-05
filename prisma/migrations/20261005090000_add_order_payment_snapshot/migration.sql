-- What each payment covered (order lines, details and total at the time),
-- so later changes can be compared against what the customer actually paid.
ALTER TABLE "OrderPayment" ADD COLUMN "orderSnapshot" JSONB;
