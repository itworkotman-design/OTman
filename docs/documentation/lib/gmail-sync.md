# Gmail Sync

## Source

- `lib/email/gmailSync.ts`

## Responsibility

Polls Gmail for recent messages containing OTman thread tokens and imports matching messages into order conversations.

## Functions

| Function | Description |
| --- | --- |
| `decodeBase64Url` | Decodes Gmail base64url message bodies into UTF-8 text. |
| `getHeader` | Reads a named Gmail message header. |
| `collectMessageBodies` | Recursively extracts plain-text and HTML body parts from a Gmail message payload. |
| `extractThreadToken` | Finds an `[OTMAN:<threadToken>]` marker in message content. |
| `parseGmailDate` | Parses Gmail header dates with a current-time fallback. |
| `parseGmailMessage` | Converts a full Gmail API message into the app's import shape. |
| `createGmailClient` | Creates an OAuth-authenticated Gmail API client from environment credentials. |
| `isAdminSender` | Checks whether a sender is the configured Gmail/admin account. |
| `syncGmailOrderConversations` | Searches Gmail, skips duplicate imported message ids, stores matching order messages, and updates order email attention for inbound customer replies. |
