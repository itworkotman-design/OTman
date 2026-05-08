# Send Gmail Email

## Source

- `lib/email/sendGmailEmail.ts`

## Responsibility

Builds a Gmail API MIME message and sends order conversation email with optional reply threading metadata. The helper verifies that the authenticated OAuth account matches `GMAIL_ACCOUNT_EMAIL`, sends visibly from `GMAIL_SEND_AS_EMAIL`, keeps backup recipients in BCC, can pass an existing Gmail `threadId` in `requestBody.threadId`, logs Gmail send-as aliases with verification/default status, rejects non-accepted send-as aliases before send, logs detailed Gmail API failures around send and metadata lookup, and returns a sync warning instead of throwing when Gmail accepts the send but post-send metadata lookup fails.

## Functions

| Function | Description |
| --- | --- |
| `REQUIRED_GMAIL_SCOPES` | Lists the Gmail OAuth scopes required by send, sync, and send-as alias lookup. |
| `getGmailErrorDebug` | Extracts message, code, status, response data, and stack from Gmail API errors for diagnostics. |
| `isGmailOAuthScopeMissing` | Detects Gmail 403 insufficient-scope responses so callers can return a specific error reason. |
| `formatSendAsAliases` | Reduces Gmail send-as alias rows to the fields needed for alias verification logging. |
| `formatRecipient` | Converts a recipient object into a quoted display-name email string when a name is present. |
| `encodeBase64Url` | Encodes raw MIME content into Gmail API base64url format. |
| `buildMimeMessage` | Builds the multipart MIME payload with To, optional Bcc, Reply-To, and optional Gmail reply headers. |
| `sendGmailEmail` | Creates the Gmail API client, verifies the OAuth mailbox against `GMAIL_ACCOUNT_EMAIL`, verifies the send-as alias is accepted when Gmail exposes aliases, sends from `GMAIL_SEND_AS_EMAIL`, passes an existing Gmail thread id when provided, returns Gmail ids and RFC message id, and returns `syncWarning` when metadata lookup fails after send. |
