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
