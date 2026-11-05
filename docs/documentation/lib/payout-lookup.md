# lib/stripe/payoutLookup.ts

`fetchStripeSettlements(stripe, { from, to, now? })` finds which Stripe payout each charge and refund went out in, for the monthly web-sales report.

- Walks the payouts created from the month's start until 35 days after its end (never past now), skipping failed or cancelled ones. For each, it reads the balance transactions (`expand: ["data.source"]`).
- Charges are mapped by payment intent and refunds by refund id, to `{ payoutId, payoutDate, feeNok }`. Dates are in Oslo time.
- `payoutsInMonth`: the payouts with an arrival date in the month, which is what the bank statement shows.

Takes a narrow `StripePayoutClient` slice of the Stripe client (list calls auto-paginate when iterated).
