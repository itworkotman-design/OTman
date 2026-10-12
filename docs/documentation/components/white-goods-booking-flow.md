# White Goods Booking Flow

## Source

- `app/_components/site/BookingModal/whiteGoods/WhiteGoodsBookingFlow.tsx`

## Responsibility

The homepage booking modal for every website catalog (white goods, furniture, parcel/pallet). It walks the customer through customer type, category, products and options, pickup stops, order details and contact, then a summary page. The price comes from the shared `priceWebsiteOrder`, and the order is submitted with the `shownTotal` it displayed (see `api/site-white-goods-order.md`). It also sends which product cards each pickup stop collects (`pickupCardIds`, plus `cardIds` per extra location).

Admins no longer edit through this flow: `WebsiteOrderModal`'s "Edit order" tab uses `WebsiteOrderEditTab` (see `website-order-edit-tab.md`), which reuses this flow's product card and size-bracket picker.

## Customer mode (`customer` prop)

"My order" (`CustomerOrderClient`) opens the same modal for the customer's own order, with `customer: { orderNumber, beforeCutoff, onSaved }`. It fills the flow through `loadOrderIntoFlow`, and the distance is only looked up again once a stop's address actually changes.

- **Data:** it loads `GET /api/customer/orders/[orderNumber]`. The live price uses the order's `pricingContext` (staff-set express, discount, extra and deviation) and its km rule.
- **Sections:** `showAll`, without the customer-type step or the start-category step.
- **After the 24h cutoff (`beforeCutoff` false):** only the product-options steps and the contact step stay, and a card's "add another" and "remove" controls are hidden. Delivery type and add-ons can still change (for example adding unpacking); the quantity, the products, the stops and the date can't.
- **Footer:** `CustomerOrderEditFooter`. It gets the order as loaded (captured once the flow settles) and the current draft, and sends only what changed (`buildCustomerEditPayload`). The server price is what gets saved.

## Edit mode: pickup assignment

In customer edit mode, the flow runs `findCardsWithoutPickup` on `editedDetails.pickups` (the stops it is about to send) and passes a `blockedMessage` to `CustomerOrderEditFooter`, so Save stays disabled while any product has no pickup address. Within 24h of the job, when the customer can't edit pickups, the message tells them to contact us.
