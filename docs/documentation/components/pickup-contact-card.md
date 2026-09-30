# Pickup Contact Card

## Source

- `app/_components/site/BookingModal/whiteGoods/PickupContactCard.tsx`

## Responsibility

Renders the address/contact fields for one pickup location in the homepage white-goods flow (place name, address, floor/lift, contact person — which of these show depends on `pickupSource`), plus, when there's more than one product card on the order, a checkbox + product checklist deciding which cards this location claims. Used both for the first ("pickup-contact") location, driven by `WhiteGoodsBookingFlow`'s own top-level state, and for every location after it via `ExtraPickupLocationCard`. The checklist itself is generic over whatever pool it's handed (`productPoolSections`) — see `pickupLocations.ts` for the claim/remaining-pool logic that computes that pool.

## Types

| Type | Description |
| --- | --- |
| `PickupProductChoice` | One product card offerable to the checklist: `cardId`, its display `name` (already resolved — sibling "#1"/"#2" numbering, quantity, item name for size-priced products), `code` and `iconKey` (for `ProductIcon`). |
| `PickupProductPoolSection` | Checklist items grouped by category; `label` is `null` when there's nothing worth grouping by (a single website-list category on the order), in which case the checklist renders as one flat, unlabeled list. |

## Functions

| Function | Description |
| --- | --- |
| `PickupContactCard(...)` | The card itself. The checkbox + checklist block only renders once the pool (summed across every section) has more than one card — nothing to choose between otherwise. Each checklist row shows a `ProductIcon` next to the name, matching the product grid's own icon-per-tile convention. |
| `isPickupContactStepReady` | Whether this location's own required fields (not the checklist — see `pickupLocations.isPickupLocationReady` for the combined gate) are filled, given `pickupSource`. |
