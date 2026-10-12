# Website order re-pricing

## Source

- `lib/orders/websiteOrderRepricing.ts`

## Responsibility

Re-prices an existing homepage website order from a new set of product cards, using the exact pipeline `app/api/site/white-goods-order/route.ts` uses to create one. It is shared by the customer's edit link (`/api/public/orders/[token]/edit-items`) and the admin editor (`/api/orders/[orderId]/website-items`). Order-level context (driving distance, express delivery, per-stop floors via `floorPricingInputs`, extra pickups, rabatt/leggTil/subcontractor adjustments) comes from the order as stored.

Catalog prices are frozen like the booking app's: `options.catalogPricing` (the stored cards' `OrderPricingSnapshot`, from `getSavedOrderPricingSnapshot`) prices the order with the prices it was saved with. Anything the snapshot doesn't cover, such as a product added since, comes from today's catalog. Without `catalogPricing` (the customer's own edits, "Use new price", older orders with no snapshot), today's catalog prices it. A snapshot sent in on the submitted cards is never used. Every result stores the catalog prices it used on each card (`cards[].pricingSnapshot`), so the next save prices the order the same way.

## Functions

- `recomputeWebsiteOrderPricing(order, cards, { allowIncomplete?, catalogPricing?, catalog? })` — `catalog` is today's website catalog when the caller already loaded it; left out, it's loaded here. A route that prices an order more than once loads it once and passes it to every call: loading it is nearly all of a pricing's time (~265 ms against the dev database, the pricing itself 1–7 ms). It also returns `missingPriceCardIds` (`findMissingSnapshotPrices` on the prices it would freeze). derives size brackets from dimensions, then throws `SizeBracketSelectionError` / `ItemNameRequiredError` for a size-priced card missing its brackets or name. The result also carries `pricingResult` (the engine result: every line with customer and partner price), which the admin calculator is built from. Admin saves pass `allowIncomplete` and are priced with whatever is there. The order's `deviation` is charged too, with a custom deviation's prices taken from `customDeviation` when given, else from the order's stored `pricingSnapshot`. The new snapshot keeps them. It returns the cards, built order items, summaries, pricing snapshot, `priceExVat`/`priceSubcontractor` and the order-extra lines.
- `resolveSavedCatalogPricing(order, cards, storedItems, { catalog? })` — every attempt below prices with the one `catalog` (passed in, or loaded once here). the catalog prices the order was saved with. Cards that carry them return them directly. An order saved before cards kept prices gets them read back from its stored `OrderItem` lines: each option's unit price for customer and partner, matched by option id; lines stored at 0 on both sides are skipped, since they may just be set to 0. Today's catalog fills in the rest (delivery types, price-list settings). The result is only returned if pricing with it gives exactly the order's saved `priceExVat` and `priceSubcontractor`; otherwise `null`. Used by `website-items` (PUT) and `website-details` (GET) as `catalogPricing`. As of 2026-10-12 it reproduced all 7 existing website orders exactly. Candidates are tried in order: today's catalog, then today's catalog with customer prices ÷ 1.25 (`catalogCustomerPricesExVat`, for orders converted to ex. VAT). Each is tried alone and with the stored lines' option prices laid over it. The frozen snapshot's price-list settings (km, floors, extra pickups…) are used for pricing too, not just its product prices. The result also carries `customerTotals` (ex. VAT and incl. VAT summed per line), and the stored snapshot keeps that `totalIncVat`.
- `websiteOrderPricingWrites(order, recomputed, data)` — the Prisma writes for a `$transaction`. These are the order update (cards, snapshot, totals, summaries, `websiteBookingDetails.orderExtras`, plus the caller's `data`), a delete of the old `OrderItem` rows, and a create of the new ones.

## Km rule

The order's `createdAt` decides the km rule (`usesFullDistanceKmPricing`). Orders made before `FULL_DISTANCE_KM_PRICING_FROM` keep the old "only km above 20" rule, so re-pricing never moves what the customer saw. Every caller passes `createdAt`: `website-items`, `website-details` and the customer's `edit-items` (via `getOrderByActionToken`). A missing date means a new order, so the new rule applies.

## Order extras set to 0

Taken from `order.nulledOrderExtras` when given; otherwise the ones stored in the order's `pricingSnapshot` are kept. Either way they're written back into the new snapshot.
