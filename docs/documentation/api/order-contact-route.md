# Order Contact Route

## Source

- `app/api/orders/[orderId]/contact/route.ts`

## Responsibility

Provides the order-creator contact conversation API for reading messages, sending creator replies to admins, and marking admin replies as read for the creator archive.

## Functions

| Function | Description |
| --- | --- |
| `formatPersonName` | Chooses a display name from username or email. |
| `buildSubject` | Builds the default order conversation subject. |
| `appendThreadToken` | Adds the internal OTMAN thread token to creator-sent messages. |
| `getOrderCreatorEmailAttention` | Calculates creator-facing unread state from admin replies and the creator read marker. |
| `getMembership` | Loads the active membership and permissions for the session. |
| `GET` | Returns the visible order conversation and role-appropriate unread state. |
| `POST` | Stores an order-creator message as an inbound admin-facing message and raises admin mail attention. |
| `PATCH` | Marks admin replies as read for the order creator by updating `orderCreatorEmailReadAt`. |
