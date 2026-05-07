# GSM Build Order Payload

## Source

- `lib/integrations/gsm/buildOrderPayload.ts`

## Responsibility

Builds the GSM order payload from an OTman order, omits blank or placeholder pickup addresses so the rest of the order can still be sent to GSM, sends pickup addresses as `pick_up` tasks, sends delivery and return addresses as `drop_off` tasks, keeps innbaering/transport delivery as `drop_off` even when install options are selected, sends install-only delivery as `assignment`, and formats the GSM description from the same grouped product summary used in the archive table plus lift, floor, and Norwegian canonical return-option text.

## Functions

| Function | Description |
| --- | --- |
| `normalizePhone` | Normalizes a phone string to digits with an optional leading `+`. |
| `normalizePhones` | Deduplicates and normalizes a list of optional phone values. |
| `normalizePickupAddress` | Converts blank values and the `No shop pickup address` placeholder into an omitted GSM pickup task. |
| `formatLiftForDescription` | Converts saved lift values into `Ja` or default `No` text for GSM. |
| `buildLocationDetails` | Builds the GSM description location lines for lift and floor. |
| `getRawDataString` | Reads a string field from order item raw data without trusting the raw data shape. |
| `getItemOptionCode` | Resolves the best option code for a saved order item from `optionCode`, `mappedOptionCode`, or raw `code`. |
| `getGsmSummaryItems` | Canonicalizes return option labels so `RETURNSTORE` sends `Retur til butikk` and `RETURNREC` sends `Retur til gjenvinningsstasjon` in GSM descriptions. |
| `buildDescription` | Builds the GSM task description from grouped `items` data when available, lift/floor details, and fallback legacy summaries for older orders. |
| `getTimeWindowIso` | Converts the stored delivery date and time window into GSM ISO completion bounds. |
| `getRawDataCategory` | Reads a structured option category from order item raw data. |
| `hasMontering` | Detects structured install work through `INSTALL_OPTION` items or raw category `install` for fallback assignment detection. |
| `getDeliveryTaskCategory` | Chooses GSM delivery task category so innbaering/transport delivery is `drop_off`, install-only delivery is `assignment`, and legacy install-only orders still fall back to assignment. |
| `buildOrderPayload` | Validates GSM prerequisites, filters unusable pickup addresses out of the task list, and builds the final GSM order payload with tasks and metafields. |
