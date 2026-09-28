# `lib/orders/publicOrderNumber.ts`

## Responsibility
The order number website customers see — in every lifecycle email, the Stripe
charge label, the pay / change / cancel pages and the confirmation screens.
Stored in `Order.orderNumber` (the existing customer-reference field: already
shown and searchable in the dashboard, sent to GSM, and put in the
`X-Otman-Order-Number` email header). The internal sequential `displayId`
(shared per-company counter, `orderNumber.ts`) is unchanged and staff-facing:
it would leak order volume and is guessable.

## Format
8 characters, random (`crypto.randomInt`), alphabet
`BCDFGHJKMNPQRSTVWXZ23456789` (27 chars, ~2.8e11 values). No vowels, so a
random string can't spell a word; no `0/O/1/I/L`, so it survives being read
over the phone.

## Functions
- `generatePublicOrderNumber()` — one random number.
- `reservePublicOrderNumber(client, companyId)` — draws until no order in the
  company uses it (there is no DB unique constraint — `orderNumber` also holds
  free-text references from imported/manual orders); throws after 10 attempts.

## Notes
- Assigned at creation in the three homepage routes; older orders have none and
  the emails/pages fall back to `#displayId` (`orderReference` in
  `customerLifecycleEmails.ts`).
