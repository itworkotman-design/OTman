# Order Creator Contact Modal

## Source

- `app/_components/Dahsboard/booking/orders/OrderCreatorContactModal.tsx`

## Responsibility

Renders the Norwegian order-creator mail center for an order, including reply composition, message history, sent-with-sync-warning messages, and the creator-side unread state.

## Functions

| Function | Description |
| --- | --- |
| `formatTimestamp` | Formats stored message timestamps for Norwegian display. |
| `getConversationBody` | Converts stored text or HTML message bodies into readable plain text. |
| `getConversationSubject` | Removes internal thread tokens from displayed subjects. |
| `formatEmailPerson` | Formats a name/email pair for message headers. |
| `ConversationMessageCard` | Renders a single expandable conversation message. |
| `OrderCreatorContactModal` | Loads the conversation, sends replies, and exposes `Marker som lest` to clear creator-facing unread mail alerts. |
