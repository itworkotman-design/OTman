# Order Alerts

## Source

- `lib/orders/alerts/capacityAlert.ts`
- `lib/orders/alerts/contactCustomerAlert.ts`
- `lib/orders/alerts/extraPickupAlert.ts`
- `lib/orders/alerts/todayDeliveryAlert.ts`
- `lib/orders/alerts/noDeliveryDateAlert.ts`
- `lib/orders/alerts/noSubcontractorAlert.ts`
- `lib/orders/alerts/missingPartnerSweep.ts`
- `lib/orders/alerts/subcontractorPriceAlert.ts`
- `lib/orders/alerts/wordpressPriceMismatchAlert.ts`
- `lib/orders/alerts/index.ts`

## Responsibility

Groups alert-center notification rules and templates used by order creation, order updates, and WordPress imports. Except for the no-subcontractor alert (`noSubcontractorAlert.ts`, which only dedups against *open* alerts so it re-fires after being resolved, both on completion transitions and from the daily missing-partner cron, see `docs/documentation/integrations/missing-partner-alerts-cron.md`), every alert here checks whether a notification of its kind has ever existed for the order (regardless of resolved state) before creating a new one, so resolving/clearing a notification does not let it reappear on a later edit.

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
| `buildNoDeliveryDateAlert` | Builds the alert for orders submitted without a delivery date. |
| `createNoDeliveryDateAlert` | Creates the no-delivery-date alert once per order, ever, when the order has no delivery date. Only reachable in practice via admin/owner submissions, since other roles are required to set a delivery date before submitting. |
| `buildNoSubcontractorAlert` | Builds the no-subcontractor alert. Takes an optional `status` (defaults to `completed`) and `overdue` (cron wording: "for more than a day"). |
| `createNoSubcontractorAlert` | Creates the no-subcontractor alert unless an unresolved one is already open for the order. |
| `runMissingPartnerAlertSweep` | Daily cron sweep: alerts on failed/completed/invoiced/paid orders with no partner whose status is older than 24h (`missingPartnerSweep.ts`, imported directly rather than via `index.ts`). |
| `buildSubcontractorPriceAlert` | Builds the subcontractor-price warning content. |
| `hasSubcontractorPriceAlertEverExisted` | Checks whether a subcontractor-price warning has ever been created for the order, regardless of resolved state. |
| `createSubcontractorPriceAlert` | Creates a warning when both prices are numeric and subcontractor price is higher than customer price, unless one has ever existed for the order. |
| `syncWordpressPriceMismatchAlert` | Creates or resolves the WordPress price mismatch alert; skips creating a new one if a mismatch notification has ever existed for the order. |
