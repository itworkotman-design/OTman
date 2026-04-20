# GSM Build Order Payload

## Source

- `lib/integrations/gsm/buildOrderPayload.ts`

## Responsibility

Builds the GSM order payload from an OTman order, omits blank or placeholder pickup addresses so the rest of the order can still be sent to GSM, and formats the GSM description from the same grouped product summary used in the archive table.

## Functions

| Function | Description |
| --- | --- |
| `normalizePhone` | Normalizes a phone string to digits with an optional leading `+`. |
| `normalizePhones` | Deduplicates and normalizes a list of optional phone values. |
| `hasMontering` | Detects whether the order should create an `assignment` task instead of a plain drop-off task. |
| `normalizePickupAddress` | Converts blank values and the `No shop pickup address` placeholder into an omitted GSM pickup task. |
| `buildDescription` | Builds the GSM task description from grouped `items` data when available and falls back to legacy stored summaries for older orders. |
| `getTimeWindowIso` | Converts the stored delivery date and time window into GSM ISO completion bounds. |
| `buildOrderPayload` | Validates GSM prerequisites, filters unusable pickup addresses out of the task list, and builds the final GSM order payload with tasks and metafields. |
