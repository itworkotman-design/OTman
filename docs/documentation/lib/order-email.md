# Order Email Helpers

## Source

- `lib/orders/orderEmail.ts`

## Responsibility

Builds and parses order conversation email metadata, including internal thread tokens, reply aliases, subjects, sender addresses, and the HTML/plain-text bodies used by order conversation messages. Customer-visible subject and body output do not include `[OTMAN:<threadToken>]` or repeated order-title text; routing uses `reply+<threadToken>@reply.otman.no` and stored Gmail thread metadata. Conversation signatures use the bilingual logistics department block and the HTML template includes the configured public order email logo URL through `lib/email/emailAssets`.

## Functions

| Function | Description |
| --- | --- |
| `stripThreadTokenMarkers` | Removes visible `[OTMAN:<threadToken>]` markers from generated or quoted message text. |
| `createOrderEmailThreadToken` | Creates a unique token used to link email replies back to one order. |
| `buildReplySubject` | Prefixes a subject with `Re:` when needed. |
| `extractThreadTokenFromSubject` | Reads a legacy thread token from an OTman subject marker. |
| `buildReplyToAddress` | Builds the `reply+<threadToken>@reply.otman.no` reply alias. |
| `extractThreadTokenFromRecipientValue` | Reads a thread token from a reply alias recipient string. |
| `extractThreadTokenFromRecipients` | Searches strings, arrays, and address objects for the first reply alias token. |
| `parseEmailAddress` | Normalizes a string or address object into an email/name pair. |
| `convertPlainTextToHtml` | Converts plain-text paragraphs into simple HTML paragraphs. |
| `getInitialAppMessageQuoteContext` | Returns quoted context only for the first admin reply to an initial app-created inbound customer message. |
| `buildOrderConversationEmailText` | Builds the plain-text order conversation email body starting with the message text, with optional first-reply context and no visible token marker. |
| `buildOrderConversationEmailHtml` | Builds the HTML order conversation email body starting with the message text, with optional first-reply context, no visible token marker, and the shared Otman logo block under the signature. |
