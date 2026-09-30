# Website Pickup Locations (logic)

## Source

- `app/_components/site/BookingModal/whiteGoods/pickupLocations.ts`

## Responsibility

Pure state-transition logic behind the homepage white-goods flow's "All products are picked up here" checkbox: which distinct products are still unclaimed at each pickup location, when a further location is actually needed, and when one is ready. Framework-free (no React) so it's unit-tested without a DOM — same convention as `steppedModalLogic.ts`. Consumed by `WhiteGoodsBookingFlow.tsx` (state, readiness gating) and `ExtraPickupLocationCard.tsx` (renders locations beyond the first, which stays backed by `WhiteGoodsBookingFlow`'s own top-level `pickupSource`/`pickupAddress`/etc. state).

## Types

| Type | Description |
| --- | --- |
| `PickupLocationState` | One pickup stop beyond the first: source, address/contact fields, and whether it claims every card still unassigned (`allRemainingHere`) or an explicit `selectedCardIds` subset. |

## Functions

Assignment is per product **card**, not per product — a product split into several independently-configured cards (`productQuantity.ts`'s `addAnotherProductCard`) can be picked up from different locations, same as the order summary's "#1"/"#2" split.

| Function | Description |
| --- | --- |
| `createPickupLocation` | Default state for a freshly-needed extra location — `allRemainingHere` defaults `true`, the same "assume one location" default the first location's own checkbox starts with. |
| `nextPickupLocationId` | One above the highest existing location id. |
| `orderedCardIds` | Every card on the order that has a product, in cart order — the pool a location's checklist offers. One entry per card (not deduped by product), so a split product shows up as several separately-assignable items. |
| `claimedCardIds` | What a location actually claims from its offered pool: everything if the pool has one card or fewer or "all here" is checked, otherwise the explicit selection (filtered against the pool). |
| `remainingAfterClaim` | The pool minus whatever was claimed. |
| `isPickupLocationReady` | Whether one location's own required fields (via `PickupContactCard.isPickupContactStepReady`) and, if it was actually offered a choice, its card selection are filled in. |
| `syncPickupLocations` | Grows or trims the extra-locations array to match how many are actually needed right now — appends one fresh location once the existing chain is fully decided but something's still unclaimed; stops looking further ahead the moment it reaches a location that hasn't claimed anything yet, so it never pre-emptively spawns locations ahead of user input; drops stale trailing locations once an earlier one claims everything. Existing entries are kept by reference so typed-in fields survive re-syncing. |
| `poolsForLocations` | The pool offered to each location in turn (for rendering checklists) and whatever's left once the last one has claimed its share. |
| `groupByCategory` | Splits an ordered list into sections by category, in first-seen category order — used by `WhiteGoodsBookingFlow.pickupPoolSections` to group a location's checklist by website-list category once the order spans more than one. |
| `hasEnteredOrderOrContactDetails` | Whether the order-details/contact steps have anything worth protecting from disappearing — see `WhiteGoodsBookingFlow`'s pickup-contact `AutoAdvance.onRetract`. |
