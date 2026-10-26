-- AlterTable
ALTER TABLE "SmsTemplate" ADD COLUMN "description" TEXT;

-- Backfill the automatic templates with the title/description that used to be
-- hardcoded in the Settings UI. Names are only replaced while they still hold
-- the original seeded default, so an admin's own name is kept.
UPDATE "SmsTemplate"
SET "description" = 'Sent at 09:00 on the order''s delivery date to the customer''s phone (Phone 2 if Phone is empty). Skips pending, cancelled, rejected and finished orders.'
WHERE "kind" = 'DAY_OF_DELIVERY' AND "description" IS NULL;

UPDATE "SmsTemplate"
SET "name" = 'Automatic SMS on delivery day'
WHERE "kind" = 'DAY_OF_DELIVERY' AND "name" = 'Leveringsdag kl. 09:00';

UPDATE "SmsTemplate"
SET "description" = 'Sent after GSM automatically completes an order (completing it by hand or by bulk update never sends one), only on the same day it was completed and only between 09:00 and 22:00'
WHERE "kind" = 'REVIEW_REQUEST' AND "description" IS NULL;

UPDATE "SmsTemplate"
SET "name" = 'Automatic review request after completion'
WHERE "kind" = 'REVIEW_REQUEST' AND "name" = 'Be om omtale etter fullført oppdrag';
