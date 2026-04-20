# Extra Pickup Notification Template

## Source

- `lib/orders/notificationTemplates/extraPickupNotification.ts`

## Responsibility

Builds the reusable order-notification title, message, and payload for orders that include extra pickups.

## Functions

| Function | Description |
| --- | --- |
| `buildExtraPickupNotification` | Builds the `Extra pickup notification` alert text, starts with `Please contact store for extra pickup.`, and appends each extra pickup with its address plus any phone/email contact details that were provided. |
