# `lib/content/movingCatalog.ts`

## Purpose
Static data for the Moving flow's size-bracket pricing (`WEBSITE_MOVING`
price list, `MOVING_BY_SIZE` product). Deliberately its own small shape —
`MovingSizeOptionSeed` — rather than reusing `WhiteGoodsProductSeed`/
`FurnitureProductSeed`, which are fitted to a delivery-type + install-option +
extras product structure that a flat "pick one bracket" price doesn't need.
Each option carries a starting price ex. VAT (2026-10, estimated from published Oslo moving and
cleaning prices): sizes 3 200 / 5 000 / 7 500 / 12 000 / 19 000 kr, Nedpakking 4 000 kr, Flyttevask
4 800 kr, floor surcharge 400 kr per floor. Staff own the real prices in `/dashboard/booking/editPrices`;
the seed only writes a starting price into a new row or one still at the old 0 kr placeholder.
Subcontractor prices stay 0.

## Exports
- `MOVING_PRICE_LIST_CODE` — re-exported from `websitePriceListCodes.ts`.
- `MOVING_PRODUCT_CODE` — `"MOVING_BY_SIZE"`.
- `MOVING_SIZE_OPTIONS: MovingSizeOptionSeed[]` — the 6 size brackets (Under 20/40/60/100/150 m², Over 150 m²; `SIZE_OVER_100` was split into `SIZE_UNDER_150` + `SIZE_OVER_150` in 2026-10 and is deactivated on reseed).
- `MOVING_SERVICES_PRODUCT_CODE` — `"MOVING_ADDITIONAL_SERVICES"`, a second
  product on the same price list for the optional extras.
- `MOVING_SERVICE_OPTIONS: MovingServiceOptionSeed[]` — Nedpakking
  (`SERVICE_NEDPAKKING`) and Flyttevask (`SERVICE_FLYTTEVASK`) — Mellomlagring
  is left out for now; flat price each (starting price seeded, staff own it), plus
  `blurbEn`/`blurbNo` tile copy used by `MovingRequestFlow` (not stored in the DB).
- `MOVING_FLOOR_SURCHARGE_PRODUCT_CODE` — `"MOVING_FLOOR_SURCHARGE"`, a third product on the same price list
  with one option, `MOVING_FLOOR_SURCHARGE_OPTION` (`FLOOR_SURCHARGE_PER_FLOOR`, "Etasjetillegg (per etasje,
  uten heis)"): the price per chargeable floor with no lift (starting price 400 kr ex. VAT).
- `MOVING_CARRY_SURCHARGE_PRODUCT_CODE` — `"MOVING_CARRY_SURCHARGE"`, a fourth product: the carrying-distance
  surcharge by parking answer, `MOVING_CARRY_SURCHARGE_OPTIONS` — `CARRY_WITHIN_50M` ("Bæreavstand: innen 50 m",
  500 kr ex. VAT) and `CARRY_FURTHER` ("Bæreavstand: lenger unna", 1 500 kr ex. VAT). Parking right outside is free.
- `MOVING_DISTANCE_ITEM_CODE` — `"MOVING_DISTANCE"`, the order-item code of the driving-distance (km) line. Not a product: the per-km rates are the moving price list's own KM_FROM_21/KM_OVER_100 settings.
