# GSM Webhook Route

## Source

- `app/api/integrations/gsm/webhook/route.ts`

## Responsibility

Processes GSM task webhooks, stores the raw webhook event, refreshes the full GSM task payload when possible, syncs order task state back into OTman, and records order history updates.

## Functions

| Function | Description |
| --- | --- |
| `mapStatus` | Maps GSM task states to OTman order statuses and normalizes both `fail` and `failed` onto the canonical `failed` key. |
| `getRecord` | Safely narrows unknown webhook payload values into plain objects. |
| `getTrimmedString` | Normalizes optional string values by trimming and dropping blanks. |
| `getFirstNonEmptyString` | Returns the first usable non-empty string from several webhook or task candidates. |
| `getMetafields` | Reads the GSM task metafields object from the fetched task payload. |
| `POST` | Verifies the webhook secret, resolves the related order, stores the webhook payload, updates GSM task tracking rows, pulls driver and vehicle metafields plus webhook notes back onto the order, imports POD PDFs on completion, and writes order-history events for the resulting changes. |
