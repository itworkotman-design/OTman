# Price Changes

## Source

- `lib/booking/pricing/priceChanges.ts`

## Responsibility

"Use new price", row by row. It compares an order priced at the catalog prices saved on its cards with the same order priced at today's catalog, and lists only the calculator rows whose price moved. Both editors use it:

- **Standard booking editor:** `BookingEditor` diffs its two pricing results, and `BookingCalculatorPanel` lists the rows.
- **Website-order modal:** `GET /api/orders/[orderId]/website-details` returns the rows as `priceChanges`, and `WebsiteOrderCalculator` lists them.

In both, the notice shows only when a row differs. A stored total that only differs from a fresh calculation (as with order 20021's lost delivery lines) no longer reads as a price change.

## Functions

| Function | Description |
| --- | --- |
| `diffCalculatorRows(saved, now)` | Each row (`CalculatorResult` breakdown line) whose customer or partner line total differs. Rows are matched by card (`cardId`; order extras as one group) and line key, code or label. A row on only one side counts as 0 on the other. Returns `PriceChangeRow`: `{ productName, label, saved, now, savedPartner, nowPartner }`, with `productName` null for an order-level row. The partner fields are numbers here; website-details sets them to null for a viewer who can't see partner prices. |
