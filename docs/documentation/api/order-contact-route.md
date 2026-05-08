# Order Contact Route

## Source

- `app/api/orders/[orderId]/contact/route.ts`

## Responsibility

Provides the order-creator contact conversation API for reading messages, sending creator replies to admins, sending a best-effort Gmail backup email for the first app-created creator message, and marking admin replies as read for the creator archive.

## Functions

| Function | Description |
| --- | --- |
| `formatPersonName` | Chooses a display name from username or email. |
| `buildSubject` | Builds the default order conversation subject. |
| `appendThreadToken` | Adds the internal OTMAN thread token to creator-sent messages. |
| `escapeHtml` | Escapes first-message notification HTML content. |
| `textToHtml` | Converts the first-message notification plain text into simple HTML paragraphs. |
| `sendFirstCreatorMessageNotification` | Sends the first app-created creator message through Gmail to `ORDER_NOTIFICATION_EMAIL` as a best-effort inbox backup. |
| `getOrderCreatorEmailAttention` | Calculates creator-facing unread state from admin replies and the creator read marker. |
| `getMembership` | Loads the active membership and permissions for the session. |
| `GET` | Returns the visible order conversation and role-appropriate unread state. |
| `POST` | Stores an order-creator message as an inbound admin-facing message, raises admin mail attention, and sends the first app-created conversation message through Gmail to the notification inbox without blocking the app save if that backup send fails. |
| `PATCH` | Marks admin replies as read for the order creator by updating `orderCreatorEmailReadAt`. |
