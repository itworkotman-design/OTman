# lib/orders/staffAlerts.ts

`alertStaff({ orderId, companyId?, title, message })` — a `MANUAL_REVIEW` notification on the order (Alert Center → Notifications) for something staff must act on. Looks up the company when not given; never throws.

Raised by:
- `sendLifecycleEmailsForOrders` — "Email to customer failed" for every customer email that couldn't be sent (kind, address, error; the error is left out when the email carried a password).
- the Stripe webhook — "Stripe payment not recorded yet" when recording a paid checkout failed (Stripe retries).
- `reconcileCheckoutSessions` — "Stripe payment recorded late" when the cron found a paid session the webhook never delivered.
