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
| `unexplainedPriceDifference` | What the order total holds beyond the product lines and the booked order extras, in whole kroner (under 1 kr is rounding, so 0). It is non-zero after the order was adjusted or re-priced after booking, and the modal shows it as an "Adjusted after booking" line. |
