-- When the last "prepare orders" email (booking archive) was sent for the
-- order. Shown as a marker in the alerts column; not part of the email
-- conversation.
ALTER TABLE "Order" ADD COLUMN "prepareEmailSentAt" TIMESTAMP(3);
