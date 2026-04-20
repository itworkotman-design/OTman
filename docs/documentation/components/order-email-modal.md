# Order Email Modal

## Source

- `app/_components/Dahsboard/booking/archive/OrderEmailModal.tsx`

## Responsibility

Renders the Alert Center modal for admins, combining order email conversation tools, order notifications that require approval, and the order history timeline.

## Functions

| Function | Description |
| --- | --- |
| `formatActor` | Formats the actor label shown in order-history entries. |
| `formatTimestamp` | Formats stored timestamps into Norwegian date-time strings. |
| `formatValue` | Normalizes history snapshot values for display. |
| `getEventTitle` | Builds the summary title for each order-history item. |
| `getConversationBody` | Converts stored email HTML/text into the cleaned message preview shown in the conversation list. |
| `getConversationSubject` | Removes the internal thread token from the subject shown to admins. |
| `formatEmailPerson` | Formats a name/email pair for email conversation metadata. |
| `getMessageStatusLabel` | Maps stored email message direction/status to the label shown in the conversation list. |
| `SnapshotGrid` | Renders created-order snapshots in the history tab. |
| `UpdatedChanges` | Renders standard field diffs for updated-order history items. |
| `ProductChanges` | Renders product-card-specific change groups in order history. |
| `StatusChange` | Renders status-change events and their optional notes. |
| `ConversationMessageCard` | Renders an expandable email conversation bubble. |
| `OrderEmailModal` | Main Alert Center modal. Loads conversation, notifications, and history; shows the renamed alert-center tabs; lets admins send email replies; refreshes the conversation after failed sends so stored `FAILED` messages appear immediately; lets admins mark email conversations complete; and lets admins resolve order notifications so yellow archive alerts clear. |
