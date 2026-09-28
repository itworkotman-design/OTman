# Delivery-only Products

## Source

- `lib/products/deliveryOnlyProducts.ts`

## Responsibility

Loads the delivery-only products of a price list (`PriceListSettings.deliveryOnly`). These have no `ProductOption`, so no `PriceListItem` — their prices live in `Product.deliveryTypes` and they're tied to the list by a `PriceListProduct` row instead. The price-list editor builds its option rows from `PriceListItem`s, so it lists these separately.

## Functions

| Function | Description |
| --- | --- |
| `getDeliveryOnlyProducts` | Returns the products linked to a price list (in product `sortOrder`) with their product config, as `DeliveryOnlyProduct`. |
