# Format Order Date

## Source

- `lib/orders/formatOrderDate.ts`

## Responsibility

Writes a stored ISO calendar date out in full for customers: "2026-10-15" → "15. oktober 2026" / "15 October 2026". The date is read as UTC, so it can't shift a day by timezone. Anything that isn't a plain ISO date is returned unchanged.

## Functions

| Function | Purpose |
|---|---|
| `formatOrderDate` | ISO date + locale → long date text. Used by the booking modal's review step and the "My order" pages. |
