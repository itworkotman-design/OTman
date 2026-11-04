# Order change text

## Source

- `lib/orders/orderChangeText.ts`

## Responsibility

Plain-text wording for a `compareOrderWithPayments` result, in Norwegian or English. The admin payment summary, the customer pay page and the balance-due email all use it, so all three say the same thing.

## Functions

- `formatKr(amount, { signed? })` — `1 250 kr`, `99,50 kr`, `+550 kr`, `−200 kr`.
- `detailLabel(key, locale)` — e.g. `pickup.2.floor` → "Henting 2: etasje".
- `describeLineChange(change, locale)` — e.g. "Lagt til: Tørketrommel — Levering til første hindring (+550 kr)" (website product names and seeded labels are translated for `no` via [website-line-labels.md](website-line-labels.md)), or "Endret: …: 1× 550 kr → 2× 1 100 kr (+550 kr)".
- `describeDetailChange(change, locale)` — e.g. "Leveringsadresse: Kirkegata 5 → Storgata 1".
- `describeOrderLine(line, locale)` / `orderLineParts(line, locale)` — one priced line of the order as the customer pays for it (incl. VAT): "27× Per km når avstanden er over 20 km: 1 080 kr", or `{ name, amount }` apart.
- `currentOrderLines(order)` / `describeOrderLines(order, locale)` — every priced line of the order now (`buildOrderStateSnapshot`), the same lines as the dashboard calculator. The Stripe Checkout description (token checkout route, `startBookingCheckout`) and the `/betaling/[token]` page's item rows.
- `paymentPageRows(lines, lineChanges, locale)` — the `/betaling/[token]` page's rows: the order now, each marked `added`/`changed` if it differs from what was paid, then the `removed` lines at their old amount (shown struck through). Marks only on a top-up; otherwise `lineChanges` is empty.
