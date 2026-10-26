# `lib/sms/automaticSms.ts`

Shared by the automatic SMS sweeps (`dayOfDeliverySweep.ts`, `reviewRequestSweep.ts`).

| Export | Description |
| --- | --- |
| `getOsloDateParts` | Returns `{ date: "YYYY-MM-DD", hour }` in Europe/Oslo time. The server runs in UTC, and `Order.deliveryDate` is an Oslo-local date string. Also re-exported from `dayOfDeliverySweep.ts`. |
| `getOsloStartOfDay` | The UTC instant of 00:00 Oslo time on the given instant's Oslo date. DST-safe: it re-reads the offset at midnight. |
| `loadEnabledTemplateBodies` | Returns a map of `companyId` → template body, for companies that have switched on the given automatic kind. |
| `AUTOMATIC_SMS_ORDER_SELECT` | `ORDER_SMS_SELECT` plus `status`. |
| `sendAutomaticSmsToOrders` | For each order: pick Phone, else Phone 2. Skip it if there's no phone, no template, or `shouldSkip(order)` returns true. Otherwise claim it by setting that kind's sent-at column (`dayOfDeliverySmsSentAt` / `reviewSmsSentAt`) with a conditional `updateMany`, then render the template and `sendOrderSms` it as SYSTEM "Automatic SMS". A claimed order whose send fails is not retried. Returns `{ scanned, sent, failed, skipped }`. |
