-- The automatic SMS moved from 09:00 on the delivery day to 19:00 the day
-- before, so the kind and its claim column are renamed to match.
ALTER TYPE "OrderSmsKind" RENAME VALUE 'DAY_OF_DELIVERY' TO 'DAY_BEFORE_DELIVERY';

ALTER TYPE "SmsTemplateKind" RENAME VALUE 'DAY_OF_DELIVERY' TO 'DAY_BEFORE_DELIVERY';

ALTER TABLE "Order" RENAME COLUMN "dayOfDeliverySmsSentAt" TO "dayBeforeDeliverySmsSentAt";

-- Name and description are fixed for automatic templates (not editable in
-- Settings), so they always follow the new timing.
UPDATE "SmsTemplate"
SET "name" = 'Automatic SMS the day before delivery',
    "description" = 'Sent at 19:00 the day before the order''s delivery date (until 22:00 at the latest) to the customer''s phone (Phone 2 if Phone is empty). Skips pending, cancelled, rejected and finished orders.'
WHERE "kind" = 'DAY_BEFORE_DELIVERY';

-- The text is editable, so it is only replaced while it is still the old
-- "i dag" default.
UPDATE "SmsTemplate"
SET "body" = 'Hei {name}! Otman kommer til deg i morgen {date} ({timeWindow}) på {address}. Oppdrag: {job}. Spørsmål? Ring oss på +47 402 84 977. Mvh Otman'
WHERE "kind" = 'DAY_BEFORE_DELIVERY'
  AND "body" = 'Hei {name}! Otman kommer til deg i dag ({timeWindow}) på {address}. Oppdrag: {job}. Spørsmål? Ring oss på +47 402 84 977. Mvh Otman';
