# Order change text

## Source

- `lib/orders/orderChangeText.ts`

## Responsibility

Plain-text wording for a `compareOrderWithPayments` result, in Norwegian or English. The admin payment summary, the customer pay page and the balance-due email all use it, so all three say the same thing.

## Functions

- `formatKr(amount, { signed? })` — `1 250 kr`, `99,50 kr`, `+550 kr`, `−200 kr`.
- `detailLabel(key, locale)` — e.g. `pickup.2.floor` → "Henting 2: etasje".
- `describeLineChange(change, locale)` — e.g. "Lagt til: Tørketrommel — Levering på dørstokken (+550 kr)", or "Endret: …: 1× 550 kr → 2× 1 100 kr (+550 kr)".
- `describeDetailChange(change, locale)` — e.g. "Leveringsadresse: Kirkegata 5 → Storgata 1".
