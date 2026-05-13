# GSM WordPress Mirror Backfill

## Source

- `scripts/backfill-gsm-mirror-to-wordpress.ts`

## Responsibility

Backfills the legacy WordPress app with current GSM-derived fields for orders that have received GSM webhook/task updates. The script defaults to dry-run, supports `--apply`, and sends the same mirror payload used by the live GSM webhook path.

## Functions

| Function | Description |
| --- | --- |
| `getMode` | Reads `--apply` and defaults to dry-run. |
| `getLimit` | Reads an optional `--limit=<count>` argument. |
| `main` | Scans orders with GSM webhook evidence, skips orders without a legacy WordPress id, logs dry-run actions, mirrors orders in apply mode, and prints summary counters. |

## Usage

- Dry-run: `npm run backfill:gsm-mirror-wordpress`
- Apply: `npm run backfill:gsm-mirror-wordpress -- --apply`
- Limited apply: `npm run backfill:gsm-mirror-wordpress -- --apply --limit=100`
