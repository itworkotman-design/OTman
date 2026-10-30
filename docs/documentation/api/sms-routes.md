# SMS Routes

All routes except the webhook and the cron route are OWNER/ADMIN only (`requireSmsAdmin`) and scoped to the active company.

## `app/api/orders/[orderId]/sms/route.ts`

| Function | Description |
| --- | --- |
| `GET` | Returns `configured`, the order's `OrderSmsMessage` history (newest first, with sender), `phoneOptions` (Phone / Phone 2), all of the company's templates (automatic ones first, so their text can also be sent by hand), and `variables` so the client can preview placeholders. Returns 404 for an order outside the company. |
| `POST` | `{ to, message }`. Renders placeholders for this order and sends via `sendOrderSms` (kind `MANUAL`). Status codes: 400 for an empty message or a missing/invalid phone, 503 when not configured, 502 for provider errors. |

## `app/api/orders/send-selected-sms/route.ts`

`POST { orderIds (1–200), message }`. Unlike send-selected-email, it texts **each selected order's own customer** (Phone, falling back to Phone 2), with placeholders rendered per order. Returns `{ ok, sentCount, failed: [{ orderId, displayId, reason }] }`. Stops with 503 on the first `SMS_NOT_CONFIGURED`. With `preview: true` it sends nothing and returns `{ ok, missing: [{ orderId, displayId, placeholders }] }`: the orders where a placeholder the text uses has no value (used for the warning in `SendSelectedSmsModal`).

## `app/api/sms/templates/route.ts` and `[templateId]/route.ts`

| Function | Description |
| --- | --- |
| `GET /api/sms/templates` | Lists templates plus `placeholders` and `configured`. Creates any missing automatic template (`DAY_BEFORE_DELIVERY`, `REVIEW_REQUEST`) from its default text, **disabled**. The check-and-create runs under a per-company Postgres advisory lock (`pg_advisory_xact_lock`) and re-checks inside it, so concurrent GETs (React dev double-mount, two tabs) never create duplicates. |
| `POST /api/sms/templates` | `{ name, description?, body }` creates a `MANUAL` template. |
| `PATCH /api/sms/templates/[id]` | Updates `body` and/or `enabled` on any template. `name` and `description` (blank clears it) are editable on `MANUAL` templates only; sending either for an automatic template → 400 `AUTOMATIC_TEMPLATE_DETAILS_LOCKED`. `kind` can't be changed. Empty name/body → 400. |
| `DELETE /api/sms/templates/[id]` | Deletes a `MANUAL` template. Automatic templates can only be switched off (400). |

## `app/api/integrations/sms/webhook/route.ts`

Receives GatewayAPI `message.status.sms` events. It verifies the `Signature` header against `GATEWAYAPI_WEBHOOK_SECRET` (401 if the header is wrong or the secret is unset). It finds the `OrderSmsMessage` by `msg_id` or by `reference` (the row id), then updates `status`, `providerStatus`, `statusUpdatedAt` (from `status_at`) and `errorMessage`. Events older than the stored status are ignored. Other event types, unknown messages and incomplete events are acknowledged with 200 so GatewayAPI doesn't retry them for 24 hours.

## `app/api/cron/day-before-delivery-sms/route.ts`

`POST [?limit=N]` with `Authorization: Bearer <CRON_SECRET>`. Runs `runDayBeforeDeliverySmsSweep` and returns `{ ok, date, skippedReason?, scanned, sent, failed, skipped }`. Scheduling: see `integrations/gatewayapi-sms.md`.

## `app/api/cron/review-request-sms/route.ts`

Same auth and `?limit`. Runs `runReviewRequestSmsSweep` and returns `{ ok, skippedReason?, scanned, sent, failed, skipped }`. Schedule it every ~15 minutes.
