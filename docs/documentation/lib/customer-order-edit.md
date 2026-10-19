# Customer Order Edit

## Source

- `lib/customerAccounts/customerOrderEdit.ts`

## Responsibility

A customer changing their own homepage order in "My order": the logic behind
`PUT /api/customer/orders/[orderNumber]` (see `docs/documentation/api/customer-orders.md`
for the full contract), moved out of the route so the Stripe webhook can apply a
change the customer has paid for in exactly the same way.

Every priced branch (catalog delivery, move, service request) goes through one
`priceGate`: the paid-order rule (`paidOrderChange.ts`), the `dryRun` answer
(`payNowIncVat`, `refundOnReviewIncVat`) and the `shownTotal` check.

## Functions

| Function | Description |
| --- | --- |
| `editCustomerOrder(order, body, { now, mode })` | Returns `{ status, json, payFirst? }` — the route sends `json` with `status`; `payFirst` means nothing was saved and the customer must pay `amountDueCents` first. `mode: "paid"` applies a change already paid for. |
| `normalizedCards` | Product cards in their full shape (also used by the route's GET). |
