# Order Notification Item Route

## Source

- `app/api/orders/[orderId]/notifications/[notificationId]/route.ts`

## Responsibility

Lets an admin mark a single order notification as fixed so the archive alert cell stops showing a yellow alert for that notification, and lets an admin edit or delete a `CUSTOM` scheduled notification.

## Functions

| Function | Description |
| --- | --- |
| `getAdminMembership` | Validates the active session and restricts access to owner/admin memberships in the active company. |
| `PATCH` | Resolves one order notification inside a transaction and returns `NOT_FOUND` if the notification is already resolved or does not belong to the order/company. |
| `PUT` | Updates the title, message, and `scheduledFor` of a `CUSTOM` notification (validated via `parseCustomNotificationInput`); returns `NOT_FOUND` if the notification isn't `CUSTOM` or doesn't belong to the order/company. |
| `DELETE` | Deletes a `CUSTOM` notification; returns `NOT_FOUND` under the same conditions as `PUT`. |
