# GSM Webhook Route

## Source

- `app/api/integrations/gsm/webhook/route.ts`

## Responsibility

Processes GSM task webhooks, stores the raw webhook event, refreshes the full GSM task payload when possible, syncs order task state back into OTman, verifies cancelled/canceled webhooks against the fresh GSM task before cancelling the OTman order, schedules POD PDF import outside the response path for completed tasks, and records order history updates while preserving hardcoded fee fields in event snapshots.

## Functions

| Function | Description |
| --- | --- |
| `normalizeGsmState` | Normalizes GSM task state text before status decisions. |
| `isCancelledState` | Detects both `cancelled` and `canceled` state spellings. |
| `mapStatus` | Maps GSM task states to OTman order statuses and normalizes both `fail` and `failed` onto the canonical `failed` key. |
| `getRecord` | Safely narrows unknown webhook payload values into plain objects. |
| `getTrimmedString` | Normalizes optional string values by trimming and dropping blanks. |
| `getFirstNonEmptyString` | Returns the first usable non-empty string from several webhook or task candidates. |
| `getMetafields` | Reads the GSM task metafields object from the fetched task payload. |
| `getTaskState` | Reads the current state from the fresh GSM task payload. |
| `getNextStatus` | Chooses the next OTman status from completed-task coverage and verified GSM status mapping, while preserving the current status for unmapped states such as `unassigned`. |
| `syncPodPdfInBackground` | Starts the retrying POD PDF sync for completed GSM tasks without awaiting it, and logs failures from the async import. |
| `POST` | Verifies the webhook secret, resolves the related order, stores the webhook payload, updates GSM task tracking rows, pulls driver and vehicle metafields plus webhook notes back onto the order, checks cancelled/canceled webhooks against the freshly fetched GSM task before changing order status, logs and records an `Ignored unverified GSM cancellation` action event when an unverified cancellation is ignored, schedules retrying POD PDF import on completion, and writes order-history events for the resulting changes. |
