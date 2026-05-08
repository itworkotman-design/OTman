# Gmail Accounts

## Source

- `lib/email/gmailAccounts.ts`

## Responsibility

Centralizes Gmail account configuration for order conversations, separating the authenticated OAuth mailbox from the visible Gmail send-as alias.

## Functions

| Function | Description |
| --- | --- |
| `normalizeEmail` | Trims and lowercases email addresses for comparisons. |
| `getGmailAccountEmail` | Returns the OAuth-authenticated Gmail account email, defaulting to `itworkotman@gmail.com`. |
| `getGmailSendAsEmail` | Returns the visible Gmail send-as alias, defaulting to `bestilling@otman.no`. |
| `getAdminEmails` | Returns normalized admin/system sender addresses for both the OAuth account and send-as alias. |
| `formatGmailSenderName` | Returns the configured display name for Gmail sender headers. |
