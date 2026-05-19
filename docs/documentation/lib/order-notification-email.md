# Order Notification Email

## Source

- `lib/orders/orderNotificationEmail.ts`

## Responsibility

Builds and sends order notification emails, using the configured Gmail send-as address in visible contact text and the configured public order email logo URL for the footer image.

## Functions

| Function | Description |
| --- | --- |
| `ORDER_NOTIFICATION_EMAIL` | Resolves the fallback notification recipient from environment configuration. |
| `escapeHtml` | Escapes dynamic values before inserting them into email HTML. |
| `formatDateNorwegian` | Formats stored delivery dates for notification emails. |
| `formatStatus` | Converts stored order status keys into readable labels. |
| `formatMoneyNok` | Formats numeric prices as NOK strings. |
| `formatLift` | Formats stored lift values for notification emails. |
| `groupItemsByCard` | Groups built order items by product card id for compact order summaries. |
| `getItemDescription` | Picks the best description label for an order item. |
| `renderOrderItemsSimple` | Renders grouped order items into compact HTML rows. |
| `buildOrderEmailLines` | Builds the order detail lines shared by notification email variants. |
| `renderSimpleLines` | Renders label/value pairs as HTML rows. |
| `buildSimpleEmailShell` | Wraps notification content in the shared email shell and footer. |
| `sendOrderNotificationEmail` | Sends a new-order notification email through the configured email provider. |
| `sendExtraPickupNotificationEmail` | Sends extra-pickup notification email to the configured recipient. |
