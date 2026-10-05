# White Goods Booking Flow

## Source

- `app/_components/site/BookingModal/whiteGoods/WhiteGoodsBookingFlow.tsx`

## Responsibility

The homepage booking modal for every website catalog (white goods, furniture, parcel/pallet). It walks the customer through customer type, category, products and options, pickup stops, order details and contact, then a summary page. The price comes from the shared `priceWebsiteOrder`, and the order is submitted with the `shownTotal` it displayed (see `api/site-white-goods-order.md`). It also sends which product cards each pickup stop collects (`pickupCardIds`, plus `cardIds` per extra location).

## Admin mode (`admin` prop)

`WebsiteOrderModal`'s "Edit order" opens this same modal on an existing order (`admin: { orderId, orderLabel, gsmSentAt, onSaved }`):

- It loads `GET /api/orders/[orderId]/website-items` and fills every field from it: products, the order's categories, customer, every pickup stop with the products it collects (`pickupStateFromStops`), delivery, date, time and the stored distance.
- `SteppedModal` runs with `showAll`: every section is open, nothing is gated, there is no summary step, and the "Go to summary" button is hidden. The start-category step is left out, because switching it would empty the order. Categories are added under "any other products?".
- The distance is only looked up again once a stop's address actually changes, so opening and saving never re-prices on its own.
- The live price includes the order's express delivery, discount, extra and deviation (`handling` from the GET), which are set in the modal's "Handle order" panel.
- The footer is `WebsiteOrderAdminFooter`, which receives the flow's products and `adminDetailsFromFlow(...)`.

In admin mode, the live price uses the order's km rule (`useFullDistanceKmPricing` from the website-items GET). A customer's new order always uses the new rule.

## Customer mode (`customer` prop)

"My order" (`CustomerOrderClient`) opens the same modal for the customer's own order, with `customer: { orderNumber, beforeCutoff, onSaved }`. It shares the admin mode's loader (`loadOrderIntoFlow`) and its distance handling.

- **Data:** it loads `GET /api/customer/orders/[orderNumber]`. The live price uses the order's `pricingContext` (staff-set express, discount, extra and deviation) and its km rule.
- **Sections:** `showAll`, without the customer-type step or the start-category step.
- **After the 24h cutoff (`beforeCutoff` false):** only the product-options steps and the contact step stay, and a card's "add another" and "remove" controls are hidden. Delivery type and add-ons can still change (for example adding unpacking); the quantity, the products, the stops and the date can't.
- **Footer:** `CustomerOrderEditFooter`. It gets the order as loaded (captured once the flow settles) and the current draft, and sends only what changed (`buildCustomerEditPayload`). The server price is what gets saved.
