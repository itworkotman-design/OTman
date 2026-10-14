# `app/api/site/moving-request/route.ts`

## Purpose
Public submission endpoint for the homepage "Flytting" (Moving) tile's
priced booking flow (`MovingRequestFlow.tsx`). Priced by size bracket
(`WEBSITE_MOVING` price list — see `lib/content/movingCatalog.ts` and
`lib/content/getMovingCatalog.ts`), not by a full pricing engine like
white-goods/furniture — the client sends `origin.sizeOptionCode`, which this route
re-resolves to a real price server-side via `getMovingCatalog()`/
`findMovingSizeOption()` rather than trusting whatever price the client
displayed. Creates an `Order` (`isWebsiteOrder: true`, real `priceExVat`/
`priceSubcontractor` and a `pricingSnapshot` from `movingOrderPricing`: the
price list's price is ex. VAT, and the customer pays it +25% rounded to whole
kroner, `status: "processing"`) + one `OrderItem` — same `Order`
model, same dashboard review UI, same approve/reject/Stripe pipeline as every
other website order; no new status value or schema change. A staff member
still reviews and approves before the customer gets a payment link, same gate
as every other website order. See `docs/homepage-ordering-roadmap.md` §6 for
the pricing architecture decision and progress log.

Independent in-memory rate limiter (20/day, 1/minute) from the other public
order routes, by design — see `lib/orders/websiteOrderValidation.ts` for the
shared field validators it reuses. Diverges from `white-goods-order` in one
respect: email is required here (that route treats it as optional), since
this flow's only possible outcome is staff emailing the customer a payment
link.

Returns `500` (`ORDER_CREATION_FAILED`) if the `WEBSITE_MOVING` price list
hasn't been seeded yet (`npm run seed:moving-catalog`), and `422` with a
`origin.sizeOptionCode` / `destination.sizeOptionCode` error if the submitted code doesn't match a real, active
bracket.

## Functions
- `POST` — validates the body, rate-limits, resolves the selected size
  bracket's real price, then creates the `Order` + `OrderItem` +
  `OrderEvent` + staff `OrderNotification`.

## Origin and destination
`origin` and `destination` are required objects `{ homeType, sizeOptionCode, floors, hasLift, parking }`,
each validated by `parseMovingProperty` (`lib/orders/movingProperty.ts`); errors come back keyed
`origin.<field>` / `destination.<field>`. Both size codes must exist in the moving catalog (422
otherwise). The move is priced on `origin.sizeOptionCode`; the destination's size is information only.
Both ends go into `Order.description` as `Moving from: …` / `Moving to: …` lines (`movingPropertyLine`
via `movingOrderDescription`).

## Additional services
Optional `serviceCodes` (string array) is resolved with
`findMovingServiceOptions` against the catalog's `services`; unknown codes,
duplicates or a non-array → 422 `errors.serviceCodes`. Each service becomes
its own `OrderItem` (`productCode: MOVING_ADDITIONAL_SERVICES`), is added to
the price via `movingOrderPricing(sizeOption, services)`, listed in
`Order.description` ("Additional services: …") and in `productsSummary` /
the notification title (`Moving (Under 40 m²) + Move-out cleaning`).


## Floor surcharge (no lift)
An apartment/office end with no lift must send `floorNumber`. Each end's `movingChargeableFloors` ×
the catalog's `floorSurcharge` price becomes a line (`movingFloorSurchargeLines`), added to the price,
saved as an `OrderItem` (`productCode: MOVING_FLOOR_SURCHARGE`, `quantity` = floors, unit price per
floor) and listed in `productsSummary`. Not seeded → no surcharge.

## Carrying distance (parking)
Each end's `parking` answer maps to a carrying-distance line (`MOVING_PARKING_OPTIONS[].surchargeCode`; right
outside is free). `movingCarrySurchargeLines` prices them from the catalog's `carrySurcharges`; each is added
to the price, saved as an `OrderItem` (`productCode: MOVING_CARRY_SURCHARGE`) and listed in `productsSummary`.

## Driving distance (km)
The route looks the driving distance pickup → delivery up itself (`getRouteDistance`, Mapbox) — any distance the
client sends is ignored — stores it on `Order.drivingDistance` and prices it with `movingDistanceLines` from the
catalog's `distanceRates` (same km rule as delivery; the size price stays). Stored as an order item
(`productCode: MOVING_DISTANCE_ITEM_CODE`, unit = per-km rate, quantity = km). A failed lookup is logged and charges
no km; staff review every website order before approving it.
