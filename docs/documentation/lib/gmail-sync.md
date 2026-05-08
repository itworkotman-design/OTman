# Gmail Sync

## Source

- `lib/email/gmailSync.ts`

## Responsibility

Polls Gmail for recent messages sent to reply-alias recipients, with legacy support for visible OTman thread tokens, and imports matching messages into order conversations. The sync uses `GMAIL_ACCOUNT_EMAIL` as the Gmail API mailbox and treats both `GMAIL_ACCOUNT_EMAIL` and `GMAIL_SEND_AS_EMAIL` as admin/system senders when deciding inbound versus outbound direction.

## Functions

| Function | Description |
| --- | --- |
| `decodeBase64Url` | Decodes Gmail base64url message bodies into UTF-8 text. |
| `getHeader` | Reads a named Gmail message header. |
| `collectMessageBodies` | Recursively extracts plain-text and HTML body parts from a Gmail message payload. |
| `extractThreadToken` | Finds an `[OTMAN:<threadToken>]` marker in message content. |
| `parseGmailDate` | Parses Gmail header dates with a current-time fallback. |
| `parseGmailMessage` | Converts a full Gmail API message into the app's import shape and extracts tokens from To/Cc reply aliases before falling back to subject/body markers. |
| `createGmailClient` | Creates an OAuth-authenticated Gmail API client from environment credentials. |
| `isAdminSender` | Checks whether a sender is one of the configured admin/system Gmail addresses. |
| `syncGmailOrderConversations` | Searches Gmail using the authenticated account, logs OAuth/send-as startup details, skips duplicate imported message ids, stores matching order messages, and updates order email attention for inbound customer replies. |
