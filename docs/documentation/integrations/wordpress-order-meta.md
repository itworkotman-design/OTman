# WordPress Order Meta Helpers

## Source

- `lib/integrations/wordpress/orderMeta.ts`

## Responsibility

Parses legacy WordPress order meta into the normalized shapes the new app needs for imports, backfills, and read-time fallbacks, including imported extra pickup addresses, default extra-pickup contact rows, the persisted express-delivery flag, and safe conversion from unknown JSON into a usable meta record. The express helper also treats checkbox-style truthy values such as string `1`, numeric `1`, `true`, `yes`, `ja`, and `on` as selected.

## Functions

| Function | Description |
| --- | --- |
| `toWordpressMetaRecord` | Converts unknown legacy raw-meta payloads into a plain record and falls back to `{}` for nulls, arrays, or non-objects. |
| `getWordpressExtraPickupAddresses` | Collects deduplicated extra pickup addresses from both nested repeater data and flattened ACF meta keys. |
| `buildWordpressExtraPickupContacts` | Builds default extra-pickup contact rows from imported addresses so legacy orders can hydrate the booking editor without losing the extra stops. |
| `normalizeWordpressExtraPickups` | Converts unknown raw WordPress meta into normalized extra-pickup addresses and default contact rows in one shared import/backfill shape. |
| `getWordpressExpressDelivery` | Detects legacy express-delivery state from explicit checkbox meta, including truthy checkbox values like string or numeric `1`, or from `price_breakdown_html` when the old form stored the express row only in the saved breakdown. |
