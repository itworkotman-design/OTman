# Build Order Items From Cards

## Source

- `lib/orders/buildOrderItemsFromCards.ts`

## Responsibility

Converts saved product cards into persisted order item rows, including option metadata, read-only WordPress mismatch rows with saved quantities, and the customer/subcontractor prices used for the order.

## Functions

| Function | Description |
| --- | --- |
| `decimalStringToCents` | Converts a decimal kroner string into integer cents. |
| `getEffectiveCustomerPrice` | Returns the discounted effective customer price when present, otherwise the base customer price. |
| `getAmount` | Resolves the effective product quantity for an order item. |
| `getPeopleCount` | Resolves the effective people count for products that support it. |
| `getHoursInput` | Resolves the effective labor-hour quantity for products that support it. |
| `findBaseProductOption` | Finds the default active option for products without explicit install, return, or extra selections. |
| `findDemontOption` | Finds the active `DEMONT` option for products that support demont. |
| `findXtraSpecialOption` | Finds the active XTRA special option. |
| `buildOrderItemsFromCards` | Builds product-card, option, custom-section, demont, return, and read-only WordPress mismatch item rows using effective customer prices for discounts, preserving read-only WP quantity and unit-price metadata. |
