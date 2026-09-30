# Extra Pickup Location Card

## Source

- `app/_components/site/BookingModal/whiteGoods/ExtraPickupLocationCard.tsx`

## Responsibility

Renders one pickup stop beyond the first in the homepage white-goods flow — a source tile-select (`PickupSourceStep`) followed by a `PickupContactCard` (address/contact/checklist) once a source is picked, wrapped in a heading ("Pickup location 2", "3", ...). Rendered inside `WhiteGoodsBookingFlow`'s "pickup-contact" `StepSection` itself (stacked via `AnimatedStack`, keyed by location id) rather than as its own `StepSection` — see `pickupLocations.ts` and the roadmap's 2026-09-30 entry for why: keeping the outer section array's shape fixed is what lets order-details/contact stay on screen while a customer splits their pickup across more locations.

## Functions

| Function | Description |
| --- | --- |
| `ExtraPickupLocationCard({ locale, bookingLocale, index, location, productPoolSections, onChange })` | `index` is 0 for the second overall pickup location. `productPoolSections` (`PickupContactCard.PickupProductPoolSection[]`) is this location's offered pool, pre-grouped by category and pre-resolved to icon/name — computed by `WhiteGoodsBookingFlow.pickupPoolSections`. `onChange` patches the one `PickupLocationState` entry it owns (in `WhiteGoodsBookingFlow`'s `extraPickupLocations` array) — this component holds no state of its own. |
