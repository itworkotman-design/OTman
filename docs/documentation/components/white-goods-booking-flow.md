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
