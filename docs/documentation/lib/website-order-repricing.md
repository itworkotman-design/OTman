# Website order re-pricing

## Source

- `lib/orders/websiteOrderRepricing.ts`

## Responsibility

Re-prices an existing homepage website order from a new set of product cards, using the exact pipeline `app/api/site/white-goods-order/route.ts` uses to create one. It is shared by the customer's edit link (`/api/public/orders/[token]/edit-items`) and the admin editor (`/api/orders/[orderId]/website-items`). Order-level context (driving distance, express delivery, per-stop floors via `floorPricingInputs`, extra pickups, rabatt/leggTil/subcontractor adjustments) comes from the order as stored. Prices always come from the live catalog.

## Functions

- `recomputeWebsiteOrderPricing(order, cards, { allowIncomplete? })` — derives size brackets from dimensions, then throws `SizeBracketSelectionError` / `ItemNameRequiredError` for a size-priced card missing its brackets or name. The result also carries `pricingResult` (the engine result: every line with customer and partner price), which the admin calculator is built from. Admin saves pass `allowIncomplete` and are priced with whatever is there. The order's `deviation` is charged too, with a custom deviation's prices taken from `customDeviation` when given, else from the order's stored `pricingSnapshot`. The new snapshot keeps them. It returns the cards, built order items, summaries, pricing snapshot, `priceExVat`/`priceSubcontractor` and the order-extra lines.
- `websiteOrderPricingWrites(order, recomputed, data)` — the Prisma writes for a `$transaction`. These are the order update (cards, snapshot, totals, summaries, `websiteBookingDetails.orderExtras`, plus the caller's `data`), a delete of the old `OrderItem` rows, and a create of the new ones.

## Km rule

The order's `createdAt` decides the km rule (`usesFullDistanceKmPricing`). Orders made before `FULL_DISTANCE_KM_PRICING_FROM` keep the old "only km above 20" rule, so re-pricing never moves what the customer saw. Every caller passes `createdAt`: `website-items`, `website-details` and the customer's `edit-items` (via `getOrderByActionToken`). A missing date means a new order, so the new rule applies.
