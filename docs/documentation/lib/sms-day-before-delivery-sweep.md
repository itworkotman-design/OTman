# `lib/sms/dayBeforeDeliverySweep.ts`

| Export | Description |
| --- | --- |
| `getOsloDateParts` | Re-exported from `automaticSms.ts`. |
| `DAY_BEFORE_DELIVERY_SMS_HOUR` / `DAY_BEFORE_DELIVERY_SMS_END_HOUR` | The Oslo-time send window, 19 to 22. |
| `runDayBeforeDeliverySmsSweep` | Called by `POST /api/cron/day-before-delivery-sms`. It does nothing outside 19:00–22:00 Oslo time (`BEFORE_SEND_HOUR` / `AFTER_SEND_HOUR`), when not configured, or when no company has an enabled `DAY_BEFORE_DELIVERY` template. Otherwise it loads **tomorrow's** orders (the next Oslo calendar day, so month ends and DST are handled) for those companies that haven't been texted yet and aren't GDPR-anonymized. It skips statuses that aren't accepted or are closed (pending, processing, rejected, cancelled, failed, completed, invoiced, paid; the same for dashboard and homepage orders, so a new homepage order nobody has confirmed isn't texted) and orders with no phone (Phone 2 is the fallback). The claim-then-send loop is `sendAutomaticSmsToOrders` (claims `dayBeforeDeliverySmsSentAt`), so repeated or parallel runs never double-send. Returns `{ date, skippedReason?, scanned, sent, failed, skipped }`, where `date` is the delivery date being texted. |
