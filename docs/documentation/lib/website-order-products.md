# Website Order Products

## Source

- `lib/orders/websiteOrderProducts.ts`

## Responsibility

Turns a website order's stored pricing lines (`Order.pricingSnapshot.lines`, one row per product card and per chosen option) into one group per product card for the admin `WebsiteOrderModal`.

## Functions

| Function | Purpose |
|---|---|
| `groupPricingLinesByCard` | One group per `cardId`, in first-seen order, with the product name, its priced lines (option label, falling back to the option code), and their total. A bare `PRODUCT_CARD` row is only listed when it carries a price itself. |
| `pricingLinesFromSnapshot` | Reads `lines` out of the stored snapshot JSON, keeping only well-formed rows. Returns `[]` for a missing or malformed snapshot. |
| `checkWebsiteOrderTotals` | Sanity check for the admin modal. Returns `linesTotal` (products + order extras); `missingFromLines`, what the total holds beyond those lines ± a manual discount/surcharge (under 1 kr is rounding, so 0); and `differsFromShown`, the total minus the `shownTotal` the customer saw at booking. Any non-zero value is a red warning in `WebsiteOrderModal`, because the customer pays what they were shown. |
