# WordPress GSM Mirror

## Source

- `lib/integrations/wordpress/mirrorGsmUpdateToWordpress.ts`

## Responsibility

Sends GSM-derived order changes from the new app back to the legacy WordPress app through the `otman/v1/power-order-gsm-mirror` endpoint. The payload includes status, status notes, driver fields, driver info, license plate, deviation, fee fields, manual adjustments, GSM ids, and order attachment download links.

## Functions

| Function | Description |
| --- | --- |
| `buildAppUrl` | Builds absolute app URLs for attachment download links. |
| `mirrorGsmUpdateToWordpress` | Validates mirror environment variables, builds attachment download URLs, posts the GSM mirror payload to WordPress, and logs non-2xx responses. |
