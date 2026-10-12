# Website Price Changes

## Source

- `lib/orders/websitePriceChanges.ts`

## Responsibility

Checks that a website order's saved catalog prices are complete. The row-by-row comparison with today's catalog lives in `lib/booking/pricing/priceChanges.ts` (see `price-changes.md`).

## Functions

| Function | Description |
| --- | --- |
| `findMissingSnapshotPrices(cards, snapshot)` | Card ids whose saved catalog prices (`OrderPricingSnapshot`) lack the card's delivery type (`productId:deliveryType`) or a selected install, extra, time or return option. Cards without a product or delivery type are skipped, and missing snapshot sections count as missing. Used by `recomputeWebsiteOrderPricing` (`missingPriceCardIds`, so saves refuse with `PRICING_INCOMPLETE`), by the booking route before an order is created, and by website-details (`savedPricesIncomplete`). |

## Why

Order 20021 (Oct 2026) was once saved with a frozen snapshot that had no carry-in price for its white goods, so 940 kr of delivery dropped out of the stored total without any error. The check makes that case visible and stops it from being saved.
