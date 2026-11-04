# POST /api/cron/stripe-reconcile

`app/api/cron/stripe-reconcile/route.ts` → `lib/stripe/reconcileCheckoutSessions.ts`

The safety net under the Stripe webhook. Schedule it **every 15 minutes** (external scheduler, `Authorization: Bearer $CRON_SECRET`). Does nothing with `HOMEPAGE_PAYMENT_MODE=manual`.

For homepage orders updated in the last 7 days (`RECONCILE_LOOKBACK_DAYS`) whose `stripeCheckoutSessionId` has no recorded `OrderPayment`, it asks Stripe how the session ended (max 50 per run; sessions younger than 10 minutes and paid "My order" change sessions are left alone):

- **paid** → recorded exactly as the webhook would (`handleCheckoutSessionCompleted`, `lib/stripe/checkoutSessionHandlers.ts`) and, if that recorded something new, a staff alert "Stripe payment recorded late" on the order;
- **expired** → the expiry runs (`handleCheckoutSessionExpired`: an unpaid booking is cancelled);
- **open** → left alone.

Returns `{ ok, checked, recovered, expired, failed }`. Both handlers are idempotent (payments keyed on the session id), so racing the webhook is harmless.
