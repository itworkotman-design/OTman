# Order Emails Route

## Source

- `app/api/orders/[orderId]/emails/route.ts`

## Responsibility

Loads one order's email conversation, returns the active order email as the default recipient, sends admin replies from the configured Gmail send-as alias to the customer, blocks outbound sends when company order emails are disabled, records successful Gmail sends immediately, stores Gmail ids on outbound messages, and records failed outbound attempts with the provider error so they appear inside the Alert Center conversation. Outbound customer-visible subjects and bodies omit `[OTMAN:<threadToken>]`; inbound routing uses `reply+<threadToken>@reply.otman.no` and existing Gmail thread ids. The route logs detailed Gmail and Prisma failure fields around the outbound send/persist path and includes Gmail failure details in the 502 response, including `GMAIL_OAUTH_SCOPE_MISSING` plus required scopes when Gmail returns insufficient OAuth scopes.

## Functions

| Function | Description |
| --- | --- |
| `getAdminMembership` | Validates that the current request belongs to an active admin or owner in the selected company and loads the company's `orderEmailsEnabled` setting. |
| `getTrimmedString` | Normalizes optional string input values from the request body. |
| `escapeHtml` | Escapes dynamic strings before they are inserted into stored failure HTML. |
| `buildFailedConversationBody` | Builds the plain-text failure message stored when an outbound send fails. |
| `GET` | Returns the stored email conversation, thread metadata, and active order email/name as the default recipient for one order. |
| `POST` | Sends an admin email reply from the Gmail send-as alias to the customer, keeps backup copies in BCC only, filters admin/system mailboxes out of primary recipients, uses the reply-token address as `Reply-To`, passes the original stored Gmail thread id to `messages.send`, preserves that stored thread id when Gmail returns a different thread, stores `GMAIL` outbound metadata after `messages.send`, and stores `SENT_WITH_SYNC_WARNING` when Gmail sends but post-send metadata lookup warns. |
| `PATCH` | Marks the conversation as complete by clearing email-attention flags on the order. |
