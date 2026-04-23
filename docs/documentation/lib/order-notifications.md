# Order Notifications

## Source

- `lib/orders/orderNotifications.ts`

## Responsibility

Provides the shared create and resolve helpers that keep `OrderNotification` rows and the derived unread-notification counters on `Order` in sync. The extra-pickup alert flow and the WordPress price-mismatch importer alert both use these helpers to light the archive `Alerts` cell until the notification is marked fixed.

## Functions

| Function | Description |
| --- | --- |
| `hasOpenCapacityNotification` | Checks whether an unresolved capacity-review notification already exists for the same delivery date and time window. |
| `createOrderNotification` | Creates an order notification, recalculates the unresolved notification count for the order, and updates the order-level alert flags used by the archive table. |
| `resolveOrderNotification` | Marks one unresolved notification as fixed, recalculates the remaining unresolved count, and clears the order-level alert flags when no unresolved notifications remain. |
| `resolveOutdatedCapacityNotifications` | Resolves stale capacity-review notifications whose stored delivery date or time window no longer matches the order. |
