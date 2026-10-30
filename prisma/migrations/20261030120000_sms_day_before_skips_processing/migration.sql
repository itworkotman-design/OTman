-- The day-before-delivery SMS now also skips orders still in "processing"
-- (not yet accepted). The automatic template's description isn't editable in
-- Settings, so the stored text is updated to say so — only while it is still
-- the previous default.
UPDATE "SmsTemplate"
SET "description" = 'Sent at 19:00 the day before the order''s delivery date (until 22:00 at the latest) to the customer''s phone (Phone 2 if Phone is empty). Skips pending, processing, cancelled, rejected and finished orders.'
WHERE "kind" = 'DAY_BEFORE_DELIVERY'
  AND "description" = 'Sent at 19:00 the day before the order''s delivery date (until 22:00 at the latest) to the customer''s phone (Phone 2 if Phone is empty). Skips pending, cancelled, rejected and finished orders.';
