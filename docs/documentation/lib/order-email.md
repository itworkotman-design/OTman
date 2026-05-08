# Order Email Helpers

## Source

- `lib/orders/orderEmail.ts`

## Responsibility

Builds and parses order conversation email metadata, including thread tokens, reply aliases, subjects, sender addresses, and the HTML/plain-text bodies used by order conversation messages. Conversation signatures use the configured Gmail send-as alias.

## Functions

| Function | Description |
| --- | --- |
| `createOrderEmailThreadToken` | Creates a unique token used to link email replies back to one order. |
| `buildThreadedSubject` | Adds the `[OTMAN:<threadToken>]` marker to a subject when it is missing. |
| `buildReplySubject` | Prefixes a subject with `Re:` when needed. |
| `extractThreadTokenFromSubject` | Reads a thread token from an OTman subject marker. |
| `buildReplyToAddress` | Builds the `reply+<threadToken>@reply.otman.no` reply alias, with an env override for the domain. |
| `extractThreadTokenFromRecipientValue` | Reads a thread token from a reply alias recipient string. |
| `extractThreadTokenFromRecipients` | Searches strings, arrays, and address objects for the first reply alias token. |
| `parseEmailAddress` | Normalizes a string or address object into an email/name pair. |
| `convertPlainTextToHtml` | Converts plain-text paragraphs into simple HTML paragraphs. |
| `buildOrderConversationEmailText` | Builds the plain-text order conversation email body with token marker and optional quoted context. |
| `buildOrderConversationEmailHtml` | Builds the HTML order conversation email body with token marker and optional quoted context. |
