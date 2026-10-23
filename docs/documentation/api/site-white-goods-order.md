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

Other validation errors are `422 VALIDATION_FAILED` with `errors`. Among them: `preferredDate` must be a day the booking calendar offers (`isBookableDeliveryDate`), and `timeWindow` must be a preset or a real `HH:MM-HH:MM` range (`isTimeWindowComplete`). An install add-on with an install type it excludes (integrated front panel on a freestanding fridge-freezer) is also refused. So is taking the empty pallet without taking the goods off it, and TV setup without a TV provider and the whole checklist confirmed (see `lib/tv-setup.md`). With `customerType: "business"`, `orgNumber` is required (`errors.orgNumber`: `Required` / `Invalid organisation number`, see `isValidOrgNumber`); it is stored in `websiteBookingDetails.orgNumber`, and `name` is the company name.

The product cards are checked with `validateWebsiteOrderCards` (the same rules a later "My order" edit gets). Once the order is saved, `welcomeWebsiteOrderCustomer` links or creates the customer's "My order" account and sends the order-received email, plus the password email for a new account. See `docs/documentation/lib/customer-accounts.md`.

## Store pickup documents

**Required for every store stop.** `pickupDocumentToken` (a UUID, else `422` with `errors.pickupDocumentToken`) is the token the documents were uploaded under via `POST /api/site/white-goods-order/pickup-document` (see `site-white-goods-order-pickup-document.md`). Once everything else validates, the route reads the staged `PendingQuoteAttachment` names for the token; if any store stop (first pickup = 0, then `extraPickupLocations` in order) has no `Pickup N - …` file (`storePickupStopIndexes` + `stopsMissingPickupDocument`), it returns `422` with `errors.pickupDocument`. After the price check and before the order is created, `promotePendingQuoteAttachments` moves them from `tmp/` to `orders/` (a failed copy → `500`, no order); after the order is created `linkPendingQuoteAttachments` turns them into `OrderAttachment`s (`ATTACHMENT`, `source: "pickup-document"`, named `Pickup N - <file>`) — listed in the admin website-order modal's attachments, and linked on the GSM pickup tasks. A `PRICE_CHANGED` refusal leaves them staged, so a resubmit with the same token still links them.

## Pickup assignment

When the order is split across pickups (`extraPickupLocations`), every product card must be on exactly one stop (`pickupCardIds` for the first, `cardIds` for the rest), checked with `findCardsWithoutPickup`. Otherwise the route returns `422 VALIDATION_FAILED` with `errors.pickups`.
