# WordPress Order Import Verification Script

## Source

- `scripts/verify-wordpress-order-import.ts`

## Responsibility

Verifies a historical WordPress order import by comparing the WordPress REST total count with the number of imported Prisma orders that have a `legacyWordpressOrderId`, then spot-checks recent imported totals against the preserved raw WordPress meta.

## Functions

| Function | Description |
| --- | --- |
| `main` | Runs verification, logs the count comparison and spot checks, and exits non-zero when WordPress exposes a total count that differs from the imported count. |
