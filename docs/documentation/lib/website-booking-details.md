# Website Booking Details

## Source

- `lib/orders/websiteBookingDetails.ts`

## Responsibility

A structured, versioned copy of what the customer entered in the homepage white-goods flow. `POST /api/site/white-goods-order` stores it on `Order.websiteBookingDetails`, together with `Order.websiteOrderKind = "WHITE_GOODS"`. The admin `WebsiteOrderModal` reads it back.

The regular order columns can't hold this data: `Order.floorNo` / `lift` are one combined pair, and the extra pickup stops otherwise only exist as free text in the description.

What it stores:
- customer type;
- every pickup stop (source, place, address, floor and lift, contact, products collected);
- the delivery (address, floor and lift);
- date, time window and driving distance;
- the order-extra lines as priced at booking (floor surcharge, extra pickups, distance). The pricing snapshot only keeps product lines.

`BookingPickupStop` is the same type as the homepage review page's `ReviewPickup` (`orderReview.ts`), so both render through `buildOrderReviewBlocks`.

## Functions

| Function | Purpose |
|---|---|
| `buildWhiteGoodsBookingDetails` | Builds version-1 details from the route's already-parsed values. A store stop gets no floor or lift. Floor 0 ("not given") becomes `null`. An unknown customer type becomes `null`. |
| `withLiveOrderFields` | Lays the order's current columns over the stored details: the first pickup address, the extra-stop addresses (only while the stop count still matches), the delivery address, date, time window and distance. An edit changes those columns, not the details. Floors, lifts, contacts and product splits stay as booked. |
| `floorPricingInputs` | Each stop's floor and lift for re-pricing an existing order (the customer's edit link). Uses the per-stop floors from the details, with a store stop as ground floor with a lift. Orders without details fall back to the one combined `floorNo`/`lift` applied to both ends, as before. |
| `parseWhiteGoodsBookingDetails` | Tolerant reader for the stored JSON. Returns `null` for anything that isn't version-1 details, and coerces malformed fields inside a stop or order-extra line to safe defaults. |

Orders created before this column existed have no details and keep opening in the regular `OrderModal`.
