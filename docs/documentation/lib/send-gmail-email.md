# Send Gmail Email

## Source

- `lib/email/sendGmailEmail.ts`

## Responsibility

Builds a Gmail SMTP transport and sends HTML email messages with optional reply threading metadata. The helper normalizes one or many recipients into nodemailer-compatible address strings.

## Functions

| Function | Description |
| --- | --- |
| `formatRecipient` | Converts a recipient object into a quoted display-name email string when a name is present. |
| `sendGmailEmail` | Creates the Gmail SMTP transport, sends the email, and returns the provider message id when available. |
