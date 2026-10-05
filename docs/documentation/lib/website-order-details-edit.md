# Website order details edit

## Source

- `lib/orders/websiteOrderDetailsEdit.ts`

## Responsibility

Admin editing of a homepage website order's details: the customer, the pickup stops (up to `MAX_PICKUP_STOPS`, added or removed), the delivery, floors/lifts, date and time window, and an optional driving-distance override. It turns the edited form into the same order columns and `websiteBookingDetails` that the booking route writes, so GSM, the standard editor and re-pricing all see the change.

## Functions

- `parseAdminOrderDetails(raw)` — trims the form; nothing is required (an admin can save anything empty). Only filled-in values are checked for format, with errors per field (`customer.phone`, `customer.email`, `pickup.2.contactPhone`, `drivingDistanceOverride`). A store pickup never has a floor or lift. Each stop's `cardIds` are kept.
- `routeAddressesChanged(stored, details)` — whether any stop's address, or the number of stops, changed (so the distance must be recalculated).
- `buildDetailsUpdate({ details, drivingDistance, storedBookingDetails, storedDescription })` — returns:
  - `orderData`: customer, addresses, extra pickups, date, time, distance, the combined `floorNo`/`lift` pair, and the description. In the description, the previously generated pickup notes are swapped for new ones (`buildPickupNoteLines`) and staff text is kept. Old-format notes on orders booked before the new format are recognised and replaced too.
  - `bookingDetails`: the booked order extras are kept until re-pricing replaces them.
- `editableDetailsFromOrder(order)` — the form's starting values.
