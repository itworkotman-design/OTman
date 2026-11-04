# scripts/check-website-prices.ts

`npm run check:website-prices` (reads `.env.local`; `ENV_FILE=.env npm run check:website-prices` for another env file). **Read-only** — writes nothing. Prints the DB host first.

Runs `checkWebsiteOrderPricing` (`lib/orders/websitePriceConsistency.ts`) over every homepage order not yet GDPR-anonymized and lists the ones where prices disagree:

- `LINES_DONT_ADD_UP` — the order's lines (Stripe description, pay page, emails) don't sum to the charged total (≥ 1 kr off).
- `CHARGED_DIFFERS_FROM_SHOWN` — the booking payment differs from the total shown when booking (`websiteBookingDetails.shownTotal`).
- `PAYMENT_STATUS_STALE` — Stripe mode: the payment badge (`Order.paymentStatus`) disagrees with what was paid.

Orders priced before per-line VAT rounding (2026-10) show a few kroner of `LINES_DONT_ADD_UP`; that's expected until the old-order conversion script has run.
