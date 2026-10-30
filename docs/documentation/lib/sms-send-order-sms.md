# `lib/sms/sendOrderSms.ts`

| Function | Description |
| --- | --- |
| `sendOrderSms` | The single send path, used by the composer, the bulk route and the automatic SMS sweeps. It refuses `EMPTY_MESSAGE`, `MISSING_PHONE` and `SMS_NOT_CONFIGURED` without writing anything. Otherwise it writes an `OrderSmsMessage` row first; an invalid number is logged as `FAILED` with no API call. It then sends with the row id as the GatewayAPI `reference`, stores `msg_id` and `sentAt` on success or `FAILED` plus `errorMessage` on failure, and writes a "SMS sent" / "SMS failed" order history action. It returns `{ ok, messageId?, reason? }` and does not throw for provider errors. |
