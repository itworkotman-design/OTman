# GSM Build Order Payload

## Source

- `lib/integrations/gsm/buildOrderPayload.ts`

## Responsibility

Builds the GSM order payload from an OTman order and omits blank or placeholder pickup addresses so the rest of the order can still be sent to GSM.

## Functions

| Function | Description |
| --- | --- |
| `normalizePhone` | Normalizes a phone string to digits with an optional leading `+`. |
| `normalizePhones` | Deduplicates and normalizes a list of optional phone values. |
| `hasMontering` | Detects whether the order should create an `assignment` task instead of a plain drop-off task. |
| `normalizePickupAddress` | Converts blank values and the `No shop pickup address` placeholder into an omitted GSM pickup task. |
| `buildDescription` | Joins the relevant order summary and note fields into the GSM task description. |
| `getTimeWindowIso` | Converts the stored delivery date and time window into GSM ISO completion bounds. |
| `buildOrderPayload` | Validates GSM prerequisites, filters unusable pickup addresses out of the task list, and builds the final GSM order payload with tasks and metafields. |
