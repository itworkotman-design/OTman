# POST /api/site/white-goods-order

## Source

- `app/api/site/white-goods-order/route.ts`

## Responsibility

Creates a homepage website order (all website catalogs: white goods, furniture, parcel/pallet). It validates the request, prices it with `priceWebsiteOrder`, and stores the order, its lines (`buildWebsiteOrderItems`) and its `websiteBookingDetails`.

**The customer pays what they were shown.** The request must include `shownTotal`, the total the booking summary displayed:

- missing → `400 SHOWN_TOTAL_REQUIRED`
- differs from the calculated total by 0.5 kr or more → `409 { reason: "PRICE_CHANGED", total }`, and nothing is stored. The booking flow then tells the customer the real price and asks them to reload.
- equal → the order is stored at that total, and `shownTotal` is kept in `websiteBookingDetails` for the admin's sanity check (`checkWebsiteOrderTotals`).

Other validation errors are `422 VALIDATION_FAILED` with `errors`.
