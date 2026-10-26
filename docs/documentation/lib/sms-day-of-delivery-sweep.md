# `lib/sms/dayOfDeliverySweep.ts`

| Export | Description |
| --- | --- |
| `getOsloDateParts` | Re-exported from `automaticSms.ts`. |
| `runDayOfDeliverySmsSweep` | Called by `POST /api/cron/day-of-delivery-sms`. It does nothing before 09:00 Oslo time, when not configured, or when no company has an enabled `DAY_OF_DELIVERY` template. Otherwise it loads today's orders for those companies that haven't been texted yet and aren't GDPR-anonymized. It skips closed statuses (pending, rejected, cancelled, failed, completed, invoiced, paid) and orders with no phone (Phone 2 is the fallback). The claim-then-send loop is `sendAutomaticSmsToOrders` (claims `dayOfDeliverySmsSentAt`), so repeated or parallel runs never double-send. Returns `{ date, skippedReason?, scanned, sent, failed, skipped }`. |
