# GatewayAPI SMS (setup + overview)

## What it does

- **Automatic SMS at 09:00 on the delivery day**: "we're coming today", with the address and what we're doing (`DAY_OF_DELIVERY` template).
- **Automatic review request after completion**: a thank-you with the https://otman.no/reviews link, sent shortly after GSM auto-completes an order, never for manual or bulk status changes (`REVIEW_REQUEST` template, see `lib/sms-review-request-sweep.md`).
- **Manual SMS per order**: SMS tab in the order's Alert Center (`OrderSmsPanel`).
- **Bulk SMS**: "Send SMS" on the order selection bar texts each selected order's own customer (`SendSelectedSmsModal`).
- **Editable templates**: the "SMS templates" section on the Settings page, below Pickup addresses (`SmsTemplatesSection`). Placeholders such as `{name}`, `{address}` and `{job}` are filled in from each order.
- **Delivery status**: the GatewayAPI webhook updates each `OrderSmsMessage` to Delivered or Failed.

All SMS UI and routes are limited to company OWNER/ADMIN (`lib/sms/smsAccess.ts`).

## Data

- `OrderSmsMessage`: the log of every SMS per order (phone, text, status, provider status, error, GatewayAPI `msg_id`). It is redacted by the GDPR cleanup.
- `SmsTemplate`: per-company templates, each with a name, an optional admin-facing `description` (never sent) and the SMS `body`, all editable by admins in Settings. `MANUAL` templates are picked in the composers. There is exactly one template per automatic kind (`DAY_OF_DELIVERY`, `REVIEW_REQUEST`) per company, and its `enabled` flag is the on/off switch for that automatic SMS. They are created **switched off** the first time the Settings page's SMS templates section loads.
- `Order.dayOfDeliverySmsSentAt` / `Order.reviewSmsSentAt`: claim flags so each order gets each automatic SMS once.
- `Order.gsmCompletedAt`: set only by the GSM webhook when it auto-completes an order; the review-request trigger.
- Migrations: `prisma/migrations/20261026120000_add_order_sms`, `20261026150000_add_review_request_sms`, `20261026170000_add_order_gsm_completed_at`, `20261026190000_add_sms_template_description` (additive; the last one backfills the automatic templates' title/description).

## Environment

| Var | Purpose |
| --- | --- |
| `GATEWAYAPI_TOKEN` | API token from the GatewayAPI dashboard (EU: app.gatewayapi.eu). If it is unset, all sending is disabled and the UI shows a warning. |
| `GATEWAYAPI_SENDER` | Sender name shown on the phone, at most 11 characters (`a-zA-Z0-9`). Default `Otman`. |
| `GATEWAYAPI_BASE_URL` | Optional. Default `https://messaging.gatewayapi.eu`. Use `https://messaging.gatewayapi.com` for a .com account. |
| `GATEWAYAPI_WEBHOOK_SECRET` | Secret configured on the webhook in the GatewayAPI dashboard, used to verify the `Signature` header. |

## Deployment (manual steps)

1. Apply the migration (`build.sh` already runs `prisma migrate deploy`).
2. Set the env vars above on the Render web service.
3. In the GatewayAPI dashboard, add a webhook for SMS status events pointing to
   `https://<app-domain>/api/integrations/sms/webhook` with the secret = `GATEWAYAPI_WEBHOOK_SECRET`.
4. Create a Render **Cron Job**. Render schedules are UTC, so run at both 07:00 and 08:00 UTC to hit 09:00 Oslo in summer and in winter:
   - Schedule: `0 7,8 * * *` (or hourly `0 7-15 * * *` to also catch same-day orders created after 09:00)
   - Command:
     ```
     curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app-domain>/api/cron/day-of-delivery-sms
     ```
   Runs before 09:00 Oslo time do nothing, and every order is claimed before it is texted, so extra runs are safe.
   Add a second cron job for the review request, every 15 minutes (`*/15 * * * *`):
     ```
     curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app-domain>/api/cron/review-request-sms
     ```
   It only texts between 09:00 and 22:00 Oslo time, so it can run around the clock.
5. Open **Settings → SMS templates**, check each automatic text, and switch it **On**.

## Source files

- `lib/sms/*` — see `lib/sms-*.md`
- `app/api/orders/[orderId]/sms`, `app/api/orders/send-selected-sms`, `app/api/sms/templates`, `app/api/integrations/sms/webhook`, `app/api/cron/day-of-delivery-sms`, `app/api/cron/review-request-sms`
- `app/_components/Dahsboard/booking/archive/{OrderSmsPanel,SmsTemplates,SendSelectedSmsModal}.tsx`
