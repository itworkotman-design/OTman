# Order Notifications Route

## Source

- `app/api/orders/[orderId]/notifications/route.ts`

## Responsibility

Returns the alert-center notification list for a single order and lets admins create custom notifications, including unresolved and resolved order notifications for admins.

## Functions

| Function | Description |
| --- | --- |
| `getAdminMembership` | Validates the active session and restricts access to owner/admin memberships in the active company. |
| `GET` | Verifies the order belongs to the active company and returns all of its notifications, including `scheduledFor`, with resolver display names for the Alert Center notifications tab. |
| `POST` | Creates a `CUSTOM` notification for the order from an admin-supplied title, message, date, and hour (6-22). |
