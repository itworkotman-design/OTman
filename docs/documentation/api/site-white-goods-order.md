# POST /api/site/white-goods-order

## Source

- `app/api/site/white-goods-order/route.ts`

## Responsibility

Creates a homepage website order (all website catalogs: white goods, furniture, parcel/pallet). It validates the request, prices it with `priceWebsiteOrder`, and stores the order, its lines (`buildWebsiteOrderItems`) and its `websiteBookingDetails`. Prices are ex. VAT. The `shownTotal` the customer confirms is compared with the total incl. VAT summed per line (`priceWebsiteOrder`'s `customerTotals`, `websiteVat.ts`), and `PRICE_CHANGED` returns that total. The order stores ex. VAT, with the incl.-VAT total in its snapshot. It always prices with today's catalog: a `pricingSnapshot` sent on the browser's cards is ignored. Each saved card keeps the catalog prices it was charged (`pricingSnapshot`, the booking app's `OrderPricingSnapshot`), so later admin saves keep them until "Use new price" (see `orders-website-items.md`).

**The customer pays what they were shown.** The request must include `shownTotal`, the total the booking summary displayed:

- missing → `400 SHOWN_TOTAL_REQUIRED`
- differs from the calculated total by 0.5 kr or more → `409 { reason: "PRICE_CHANGED", total }`, and nothing is stored. The booking flow then tells the customer the real price and asks them to reload.
- the catalog has no price for a product's delivery type or a selected option (`findMissingSnapshotPrices` on the prices it would freeze) → `409 { reason: "PRICING_INCOMPLETE" }`, and nothing is stored: the order would otherwise be booked without that charge.
- equal → the order is stored at that total, and `shownTotal` is kept in `websiteBookingDetails` for the admin's sanity check (`checkWebsiteOrderTotals`).

Other validation errors are `422 VALIDATION_FAILED` with `errors`. Among them: `preferredDate` must be a day the booking calendar offers (`isBookableDeliveryDate`), and `timeWindow` must be a preset or a real `HH:MM-HH:MM` range (`isTimeWindowComplete`). An install add-on with an install type it excludes (integrated front panel on a freestanding fridge-freezer) is also refused.

The product cards are checked with `validateWebsiteOrderCards` (the same rules a later "My order" edit gets). Once the order is saved, `welcomeWebsiteOrderCustomer` links or creates the customer's "My order" account and sends the order-received email, plus the password email for a new account. See `docs/documentation/lib/customer-accounts.md`.

## Pickup assignment

When the order is split across pickups (`extraPickupLocations`), every product card must be on exactly one stop (`pickupCardIds` for the first, `cardIds` for the rest), checked with `findCardsWithoutPickup`. Otherwise the route returns `422 VALIDATION_FAILED` with `errors.pickups`.
