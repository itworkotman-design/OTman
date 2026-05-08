# Gmail Sync

## Source

- `lib/email/gmailSync.ts`

## Responsibility

Polls Gmail for recent inbound reply-alias messages and sent admin messages, with legacy support for visible OTman thread tokens, and imports matching messages into order conversations. The sync uses `GMAIL_ACCOUNT_EMAIL` as the Gmail API mailbox, searches sent mail with `in:sent`, matches conversations by reply alias token, Gmail thread id, RFC `References`/`In-Reply-To`, or legacy subject/body token, treats both `GMAIL_ACCOUNT_EMAIL` and `GMAIL_SEND_AS_EMAIL` as admin/system senders when deciding inbound versus outbound direction, and applies Gmail labels for order emails, customer replies, admin sent mail, and attention state without blocking sync if labeling fails.

## Functions

| Function | Description |
| --- | --- |
| `decodeBase64Url` | Decodes Gmail base64url message bodies into UTF-8 text. |
| `getHeader` | Reads a named Gmail message header. |
| `collectMessageBodies` | Recursively extracts plain-text and HTML body parts from a Gmail message payload. |
| `extractThreadToken` | Finds an `[OTMAN:<threadToken>]` marker in message content. |
| `parseGmailDate` | Parses Gmail header dates with a current-time fallback. |
| `parseGmailMessage` | Converts a full Gmail API message into the app's import shape, including Gmail ids, RFC message ids, thread ids, reply headers, and tokens from Reply-To/To/Cc reply aliases before falling back to subject/body markers. |
| `createGmailClient` | Creates an OAuth-authenticated Gmail API client from environment credentials. |
| `isAdminSender` | Checks whether a sender is one of the configured admin/system Gmail addresses. |
| `ensureGmailOrderLabels` | Lists existing Gmail labels, creates missing Otman labels once per sync, and returns their ids for later message labeling. |
| `applyGmailOrderLabels` | Applies order/customer/admin/attention labels to synced Gmail messages and removes the attention label from resolved outbound threads when appropriate. |
| `syncGmailOrderConversations` | Searches Gmail inbox-style reply messages and sent messages using the authenticated account, logs OAuth/send-as startup details, skips duplicates by Gmail id or RFC message id, stores matched inbound and outbound order messages, labels Gmail messages best-effort, and updates order email attention only for inbound customer replies. |
