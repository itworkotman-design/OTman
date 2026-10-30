# Dashboard Reviews Route

## Source

- `app/api/dashboard/reviews/route.ts`

## Responsibility

Returns customer reviews to members allowed to view the dashboard Reviews section. Results use cursor pagination, are ordered newest first, and are returned in batches of 30.

## Functions

| Function | Description |
| --- | --- |
| `GET` | Validates Reviews-section access, reads an optional review cursor, and returns up to 30 reviews with `hasMore` and `nextCursor` pagination metadata. |
