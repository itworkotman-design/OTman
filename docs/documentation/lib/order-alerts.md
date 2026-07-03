# Order Alerts

## Source

- `lib/orders/alerts/capacityAlert.ts`
- `lib/orders/alerts/contactCustomerAlert.ts`
- `lib/orders/alerts/extraPickupAlert.ts`
- `lib/orders/alerts/todayDeliveryAlert.ts`
- `lib/orders/alerts/subcontractorPriceAlert.ts`
- `lib/orders/alerts/wordpressPriceMismatchAlert.ts`
- `lib/orders/alerts/index.ts`

## Responsibility

Groups alert-center notification rules and templates used by order creation, order updates, and WordPress imports. Except for the GSM-empty-subcontractor alert (`noSubcontractorAlert.ts`, which intentionally re-fires on every qualifying completion transition), every alert here checks whether a notification of its kind has ever existed for the order (regardless of resolved state) before creating a new one, so resolving/clearing a notification does not let it reappear on a later edit.

## Functions

| Function | Description |
| --- | --- |
| `buildCapacityAlert` | Builds the capacity warning notification content. |
| `hasCapacityAlertEverExisted` | Checks whether a capacity warning has ever been created for the order, regardless of resolved state. |
| `createCapacityAlert` | Creates a capacity warning when the selected delivery slot is over capacity, unless one has ever existed for the order. |
| `buildContactCustomerAlert` | Builds the alert for custom time windows where the customer must be contacted. |
| `createContactCustomerAlert` | Creates the contact-customer alert once per order, ever. |
| `buildExtraPickupAlert` | Builds the extra-pickup notification content. |
| `createExtraPickupAlert` | Creates an extra-pickup manual-review alert once per order, ever. |
| `buildTodayDeliveryAlert` | Builds the alert for orders whose delivery date is today. |
| `createTodayDeliveryAlert` | Creates the today-delivery alert once per order, ever, when the delivery date is today (no time-window/hour check). |
| `buildSubcontractorPriceAlert` | Builds the subcontractor-price warning content. |
| `hasSubcontractorPriceAlertEverExisted` | Checks whether a subcontractor-price warning has ever been created for the order, regardless of resolved state. |
| `createSubcontractorPriceAlert` | Creates a warning when both prices are numeric and subcontractor price is higher than customer price, unless one has ever existed for the order. |
| `syncWordpressPriceMismatchAlert` | Creates or resolves the WordPress price mismatch alert; skips creating a new one if a mismatch notification has ever existed for the order. |
