# Website Order Validation

## Source

- `lib/orders/websiteOrderValidation.ts`

## Responsibility

Shared input rules for the public, unauthenticated booking forms (white goods, moving, special goods). The server-side validators run in the public order routes (`app/api/site/white-goods-order`, `moving-request`, `special-goods-quote`); the matching sanitizers run on every keystroke/paste in the booking modals so customers can't type what the server would reject. Both use the same disallowed-character list (`< > ' " \` ; \ { } [ ]`).

## Functions

| Function | Description |
| --- | --- |
| `validatePhoneField` | Server check: required; digits and dashes with an optional leading `+` (spaces tolerated), 7–20 characters. |
| `validateEmailField` | Server check: optional; well-formed address without disallowed characters. |
| `validateTextField` | Server check: rejects any disallowed character. |
| `sanitizePhoneInput` | Client filter: keeps digits and `-`, plus one leading `+` (also when pasted text has a `+` before the first digit). Drops letters, spaces and every other symbol. |
| `sanitizeTextInput` | Client filter: drops the disallowed characters and stray control characters; keeps line breaks for notes. |
