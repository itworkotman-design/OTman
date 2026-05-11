# GSM Build Order Payload

## Source

- `lib/integrations/gsm/buildOrderPayload.ts`

## Responsibility

Builds the GSM order payload from an OTman order, omits blank or placeholder pickup addresses so the rest of the order can still be sent to GSM, sends pickup addresses as `pick_up` tasks, maps delivery task categories from saved delivery types (`FIRST_STEP` and `INDOOR` as `drop_off`, `RETURNIN`/return-only as `pick_up`, `INSTALL_ONLY` as `assignment`), lets selected install options override the delivery type to `assignment`, sends return addresses as `drop_off`, and formats the GSM description from the same grouped product summary used in the archive table plus lift, floor, and Norwegian canonical return-option text. WordPress-imported global `KM pris` rows are omitted from the GSM description.

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
| `isWordpressOrderPriceItem` | Detects imported global WordPress order-price rows. |
| `isWordpressKmPriceItem` | Detects imported global WordPress `KM pris` rows that should stay out of GSM descriptions. |
| `getGsmSummaryItems` | Canonicalizes return option labels so `RETURNSTORE` sends `Retur til butikk` and `RETURNREC` sends `Retur til gjenvinningsstasjon` in GSM descriptions, and filters imported WordPress `KM pris` rows out before grouping. |
| `buildDescription` | Builds the GSM task description from grouped `items` data when available, lift/floor details, and fallback legacy summaries for older orders. |
| `getTimeWindowIso` | Converts the stored delivery date and time window into GSM ISO completion bounds. |
| `getRawDataCategory` | Reads a structured option category from order item raw data. |
| `getRawProductCardDeliveryType` | Reads the saved product-card delivery type key from item raw data. |
| `matchesDeliveryType` | Compares saved delivery type text, keys, and codes against known GSM routing matches. |
| `itemMatchesDeliveryType` | Checks an order item across delivery type, option code, raw code, mapped code, and raw product-card delivery type. |
| `normalizeDeliveryTypeText` | Normalizes delivery type text for legacy category matching. |
| `isDropOffDeliveryType` | Detects legacy drop-off delivery type text. |
| `isAssignmentDeliveryType` | Detects legacy assignment delivery type text. |
| `hasMontering` | Detects selected install work through `INSTALL_OPTION` items or raw category `install` for assignment override. |
| `getDeliveryTaskCategory` | Chooses GSM delivery task category using selected install options first, then explicit delivery type mappings for `INSTALL_ONLY`, `RETURNIN`/return-only, `FIRST_STEP`, and `INDOOR`. |
| `buildOrderPayload` | Validates GSM prerequisites, filters unusable pickup addresses out of the task list, and builds the final GSM order payload with tasks and metafields. |
