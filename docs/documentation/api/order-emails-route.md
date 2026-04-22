# Order Emails Route

## Source

- `app/api/orders/[orderId]/emails/route.ts`

## Responsibility

Loads one order's email conversation, sends admin replies, blocks outbound sends when company order emails are disabled, records successful outbound messages, and records failed outbound attempts with the provider error so they appear inside the Alert Center conversation.

## Functions

| Function | Description |
| --- | --- |
| `getAdminMembership` | Validates that the current request belongs to an active admin or owner in the selected company and loads the company's `orderEmailsEnabled` setting. |
| `getTrimmedString` | Normalizes optional string input values from the request body. |
| `escapeHtml` | Escapes dynamic strings before they are inserted into stored failure HTML. |
| `normalizeEmailAddress` | Lowercases and trims email addresses for recipient deduplication. |
| `formatReplyTimestamp` | Formats stored timestamps for quoted reply context. |
| `stripHtmlToPlainText` | Converts stored HTML into plain text for threaded reply context. |
| `formatEmailPerson` | Formats a sender or recipient label from name and email. |
| `buildFailedConversationBody` | Builds the plain-text failure message stored when an outbound send fails. |
| `GET` | Returns the stored email conversation and thread metadata for one order. |
| `POST` | Sends an admin email reply, rejects the request when company order emails are disabled, stores successful outbound messages, and stores failed outbound messages plus the provider error when sending fails. |
| `PATCH` | Marks the conversation as complete by clearing email-attention flags on the order. |
