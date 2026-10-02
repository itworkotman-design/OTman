# Website Order Validation

## Source

- `lib/orders/websiteOrderValidation.ts`

## Responsibility

Shared input rules for the public, unauthenticated booking forms (white goods, moving, special goods). The server-side validators run in the public order routes (`app/api/site/white-goods-order`, `moving-request`, `special-goods-quote`); the matching sanitizers run on every keystroke/paste in the booking modals so customers can't type what the server would reject. Both use the same disallowed-character list (`< > ' " \` ; \ { } [ ]`).

## Functions

| Function | Description |
| --- | --- |
| `validatePhoneField` | Server check: required; digits and dashes with an optional leading `+` (spaces tolerated), 7–20 characters. |
| `validateEmailField` | Server check: optional; must pass `isValidEmail` and contain no disallowed characters. |
| `isValidEmail` | Practical email rules (strict subset of RFC 5321): ASCII local part of letters/digits and `. _ % + -` with no leading/trailing/double dot, max 64 chars; domain of letter/digit labels (æøå allowed for IDN domains) with inner hyphens only, max 63 per label; letters-only TLD of 2+; max 254 total. Shared by the server routes and all three booking modals. |
| `sanitizeEmailInput` | Client filter for email inputs: drops whitespace and every character no address can contain, keeps only the first `@`. |
| `validateTextField` | Server check: rejects any disallowed character. |
| `sanitizePhoneInput` | Client filter: keeps digits and `-`, plus one leading `+` (also when pasted text has a `+` before the first digit). Drops letters, spaces and every other symbol. |
| `sanitizeTextInput` | Client filter: drops the disallowed characters and stray control characters; keeps line breaks for notes. |
