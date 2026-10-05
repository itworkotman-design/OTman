# Website order handling

## Source

- `lib/orders/websiteOrderHandling.ts`

## Responsibility

The fields of a homepage website order that only an admin handles, never the customer: driver, second driver, info for the driver, license plate, deviation fee, "don't send email", internal description, express delivery, discount (`rabatt`) and extra (`leggTil`). They're edited in `WebsiteOrderAdminActions` and saved with `PUT /api/orders/[orderId]/website-items` `handling`. Express, discount, extra and the deviation change the price.

## Functions

- `parseWebsiteOrderHandling(raw)` — trims and validates. Everything may be empty. Discount and extra must be amounts in kroner (comma or dot). The deviation must be a `DEVIATION_FEE_OPTIONS` label; only the custom one keeps its own prices and description. Errors come back per field (`INVALID_HANDLING`).
- `handlingOrderData(handling)` — the order columns, with empty text stored as `null`.
- `handlingFromOrder(order)` — the panel's starting values. A custom deviation's prices and description are read from the stored `pricingSnapshot`.
- `handlingChange(initial, next)` — `{ changed, affectsPrice }`. `affectsPrice` is true when express, discount, extra or the deviation changed, which triggers a price preview.
