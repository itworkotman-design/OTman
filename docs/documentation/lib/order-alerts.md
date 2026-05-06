# Order Alerts

## Source

- `lib/orders/alerts/capacityAlert.ts`
- `lib/orders/alerts/contactCustomerAlert.ts`
- `lib/orders/alerts/extraPickupAlert.ts`
- `lib/orders/alerts/nextDayDeliveryAlert.ts`
- `lib/orders/alerts/subcontractorPriceAlert.ts`
- `lib/orders/alerts/wordpressPriceMismatchAlert.ts`
- `lib/orders/alerts/index.ts`

## Responsibility

Groups alert-center notification rules and templates used by order creation, order updates, and WordPress imports.

## Functions

| Function | Description |
| --- | --- |
| `buildCapacityAlert` | Builds the capacity warning notification content. |
| `hasOpenCapacityAlert` | Checks whether a capacity warning already exists for the same date and time window. |
| `createCapacityAlert` | Creates a capacity warning when the selected delivery slot is over capacity. |
| `buildContactCustomerAlert` | Builds the alert for custom time windows where the customer must be contacted. |
| `createContactCustomerAlert` | Creates the contact-customer alert once per unresolved order. |
| `buildExtraPickupAlert` | Builds the extra-pickup notification content. |
| `createExtraPickupAlert` | Creates an extra-pickup manual-review alert. |
| `buildNextDayDeliveryAlert` | Builds the alert for orders created today with delivery tomorrow. |
| `createNextDayDeliveryAlert` | Creates the next-day delivery alert once per matching unresolved order. |
| `buildSubcontractorPriceAlert` | Builds the subcontractor-price warning content. |
| `hasOpenSubcontractorPriceAlert` | Checks whether the same price warning already exists. |
| `createSubcontractorPriceAlert` | Creates a warning when both prices are numeric and subcontractor price is higher than customer price. |
| `syncWordpressPriceMismatchAlert` | Creates or resolves the WordPress price mismatch alert. |
