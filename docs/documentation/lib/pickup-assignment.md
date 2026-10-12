# Pickup Assignment

## Source

- `lib/orders/pickupAssignment.ts`

## Responsibility

The rule that every product on a homepage order has a pickup address. With a single pickup stop, everything is collected there. Once an order is split across several stops, each product card must be on exactly one stop that has an address.

## Functions

| Function | Description |
| --- | --- |
| `findCardsWithoutPickup(pickups, cards)` | Returns the ids of cards (with a product) that no stop collects, or that more than one stop claims. A stop with an empty address doesn't count. Always `[]` with one stop, and for older orders whose stops have no `cardIds` (they can't be checked). |
| `findPickupsWithoutProducts(pickups)` | The other side of the rule: returns the indexes of stops that collect no products. Always `[]` with one stop, and for older orders whose stops have no `cardIds`. |

## Used by

- `POST /api/site/white-goods-order`: `422 VALIDATION_FAILED` with `errors.pickups`.
- `PUT /api/orders/[orderId]/website-items` (admin edit) and `PUT /api/customer/orders/[orderNumber]` ("Min bestilling"): `422 PRODUCT_WITHOUT_PICKUP` with `cardIds`.
- `WhiteGoodsBookingFlow` (customer edit) and `WebsiteOrderEditTab` (admin edit): both run the check on the stops they are about to send, and keep Save disabled with a message until it passes. Both also block a pickup that collects no products (`findPickupsWithoutProducts`); the customer page only while pickups can still be changed (before the 24h cutoff).
- `PUT /api/customer/orders/[orderNumber]`: `422 PICKUP_WITHOUT_PRODUCT` with `pickups` (stop indexes), checked only when the stops change.
