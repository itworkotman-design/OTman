# Email Inbound Route

## Source

- `app/api/integrations/email/inbound/route.ts`

## Responsibility

Receives inbound order conversation emails, extracts the OTman thread token from explicit payload fields, subject/body markers, or any To/Cc/recipient reply alias, stores the message as an inbound order email, and marks the order for admin attention. Messages are accepted even when the canonical conversation mailbox is also a recipient.

## Mailgun Route

- Expression: `match_recipient(".*@reply.otman.no")`
- Webhook action: `https://OUR_APP_DOMAIN/api/integrations/email/inbound?secret=EMAIL_INBOUND_SECRET`
- Optional backup action: forward to `itworkotman@gmail.com`

The inbound route supports the Mailgun form fields `recipient`, `sender`, `From`, `To`, `subject`, `body-plain`, `stripped-text`, `body-html`, and `Message-Id`.

## Functions

| Function | Description |
| --- | --- |
| `getTextValue` | Normalizes unknown inbound payload values into trimmed strings. |
| `stripQuotedReply` | Removes common quoted reply blocks from inbound plain text. |
| `extractThreadTokenFromBody` | Finds `[OTMAN:<threadToken>]` markers in message text or HTML. |
| `parseInboundEmailBody` | Converts JSON, form-data, or form-urlencoded inbound provider payloads into the route's common shape. |
| `POST` | Logs that the inbound route was hit, validates the inbound secret, extracts the conversation token, finds the order by `emailThreadToken`, stores an `INBOUND` message, and increments unread mail attention fields. |
