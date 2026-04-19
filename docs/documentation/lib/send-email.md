# Send Email

## Source

- `lib/email/sendEmail.ts`

## Responsibility

Sends transactional email through Brevo for the rest of the application.

## Functions

| Function | Description |
| --- | --- |
| `sendEmail` | Sends one transactional email request to Brevo with support for direct recipients, optional BCC, reply-to headers, custom headers, and optional base64 attachments such as the monthly subcontractor Excel summaries. |
