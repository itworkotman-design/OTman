# WordPress Attachment Backfill

## Source

- `scripts/backfill-wordpress-attachments.ts`

## Responsibility

Backfills existing WordPress-imported order attachments whose `storagePath` or `sourceUrl` still points at `https://otman.no/wp-content/uploads...`. The script downloads each file into local app storage, updates `storagePath`, and keeps the original WordPress URL in `sourceUrl`.

## Functions

| Function | Description |
| --- | --- |
| `main` | Finds remote WordPress attachment rows, copies each attachment through the shared WordPress attachment storage helper, logs per-file failures, and prints a final processed count. |

## Command

- `npm run backfill:wordpress-attachments`

