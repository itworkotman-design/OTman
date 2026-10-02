# Website Extra Pickup Locations

## Source

- `lib/orders/websiteExtraPickupLocations.ts`

## Responsibility

Server-side counterpart to the homepage white-goods flow's multi-pickup-location UI (`pickupLocations.ts` on the client). Parses the `extraPickupLocations` field of a `POST /api/site/white-goods-order` request body and builds the human-readable lines folded into the order's internal `description`. Deliberately not a schema change — there's no `OrderItem`-to-pickup-location DB link; extra locations' street addresses still feed the existing `extraPickupAddress`/pricing mechanism (see `route.ts`), and which products go where is free text for staff, not structured data. Distinct from `lib/orders/extraPickups.ts`, which backs the internal dashboard's own extra-pickup UI (phone/email/`customPickupAddressId`-shaped) — this flow's extra locations carry a pickup `source`/place name/contact person/claimed product names instead, a different enough shape not to share the same parser.

## Functions

| Function | Description |
| --- | --- |
| `parseExtraPickupLocations` | Reads the raw request field into `ParsedExtraPickupLocation[]`, coercing every field to a safe default and dropping any entry with no usable address. Never throws on malformed input. |
| `buildMultiPickupDescriptionLines` | Human-readable "Pickup location N (address, source, floor N, lift/no lift, contact) — picking up: X, Y" lines (the floor part is left out for store stops and when no floor was given; it is how an extra stop's floor reaches the driver, since GSM only gets one combined floor) for the order description — empty when the order was never split across more than one location, so a normal single-location order's description is unaffected. |
| `extraPickupFloorsForPricing` | Each extra stop's floor and lift for the floor surcharge (`buildWhiteGoodsCalculatorBreakdowns`'s `extraPickupFloors`). A store stop is always ground floor with a lift, whatever the client sent, same as the first pickup. |
