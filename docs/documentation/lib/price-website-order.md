# Price website order

## Source

- `lib/booking/pricing/priceWebsiteOrder.ts`

## Responsibility

The single source of a homepage website order's price. These all call it:

- the customer's summary (`WhiteGoodsBookingFlow`)
- order creation (`app/api/site/white-goods-order`)
- re-pricing afterwards (`lib/orders/websiteOrderRepricing.ts`: admin edits and the customer's edit link)

So what the customer is shown is exactly what is stored and charged. Previously each copied the pipeline by hand, and the browser never applied the over-100 km rule. A customer was shown base delivery on top of the per-km charge, while the server dropped it.

## Functions

- `priceWebsiteOrder(input)` — product breakdowns, then extra-unit charges, assembly extras and the install-only visit, then the white-goods calculator extras (distance, floors, extra pickups, express, and an admin-set `deviation` fee whose price comes from the website price list's deviation settings, or the custom deviation's own price), then `calculateBookingPricing`. Over 100 km (`parseDistanceKm`), base delivery prices are 0, since the per-km charge replaces them. Returns `{ result, orderExtras }`.
- `buildWebsiteOrderItems(cards, products, specialOptions, { drivingDistance })` — the stored order lines (`OrderItem` rows / `pricingSnapshot.lines`), priced by the same rules so they add up to the total. Returns are priced and over-100 km delivery is stored at 0 kr.

The tests check that the lines + order extras equal the total, within and over 100 km.
