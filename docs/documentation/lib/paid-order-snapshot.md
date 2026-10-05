# Paid order snapshot

## Source

- `lib/orders/paidOrderSnapshot.ts`

## Responsibility

Records what an order looked like when the customer paid, and compares the order as it is now against that. The Stripe webhook stores a snapshot on each `OrderPayment.orderSnapshot`. The admin modal, the admin editor's preview, the customer pay page and the balance-due email all read the comparison. Both sides are built by the same function, so they compare like for like.

Amounts are what the customer is charged (`getOrderChargeAmountIncVatNok`). Homepage orders use VAT-inclusive catalog prices.

## Functions

- `buildOrderStateSnapshot(order)` — `{ version: 1, totalIncVatNok, lines, details }`.
  - **Lines:** one per product + option label (from `pricingSnapshot`), one per order extra (group `extras`), plus discount/surcharge (group `adjustment`), merged by key.
  - **Details:** raw values for every pickup stop (`pickup.<n>.address|place|floor|lift|contact`), the delivery (`delivery.address|floor|lift`), `date`, `timeWindow` and `distance`, using the live order columns laid over the booking details.
- `parseOrderStateSnapshot(value)` — reads a stored snapshot back. Returns `null` for anything malformed.
- `diffOrderStates(before, after)` — `{ lineChanges, detailChanges }` between any two snapshots. The customer's "My order" edit uses it to describe what they changed to staff and in the `order_updated` email.
- `compareOrderWithPayments({ payments, current })` — returns:
  - `outcome`: `unpaid`, `due`, `refund` or `settled`.
  - `totalPaidIncVatNok` (the sum of every payment), `currentTotalIncVatNok`, and `differenceIncVatNok` (current − paid).
  - `lineChanges` (added/removed/changed, with before/after and delta) and `detailChanges` (before/after). Both are measured against the **latest** payment that has a snapshot.
  - Payments made before snapshots existed (`hasPaidSnapshot: false`) still get the money outcome, but no itemized changes.
