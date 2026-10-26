# `lib/sms/smsAccess.ts` and `lib/sms/orderSmsFields.ts`

| Export | Description |
| --- | --- |
| `requireSmsAdmin` | Shared guard for every SMS route. Returns 401 with no session, 409 with no active company, and 403 unless the active membership is OWNER/ADMIN. On success it returns `{ companyId, membershipId, actor }`, where `actor` is the order-event actor. |
| `ORDER_SMS_SELECT` | Prisma `select` for the order columns the SMS routes need: the phones plus the template variable fields. |
| `SMS_CLIENT_ERROR_REASONS` | `sendOrderSms` reasons that the routes answer with 400 instead of 502. |
