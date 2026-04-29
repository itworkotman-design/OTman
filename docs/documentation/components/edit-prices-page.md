# Edit Prices Page

## Source

- `app/(User)/dashboard/booking/editPrices/page.tsx`

## Responsibility

Renders the price-list editor for product option rows, special option rows, product settings, and price-list global settings. The price-list settings modal edits extra pickup, express delivery, pallet XTRA, kilometer rates, and all bomtur/deviation customer and subcontractor prices.

## Functions

| Function | Description |
| --- | --- |
| `createDraftId` | Creates temporary ids for draft custom-section rows. |
| `buildProductSettingsDefaults` | Builds default product configuration flags for physical, pallet, and labor products. |
| `getDeliveryTypeEditorTitle` | Returns the label used for one delivery-type editor section. |
| `supportsXtraPrice` | Indicates whether a delivery type exposes an XTRA price input. |
| `getDeliveryTypePricePlaceholder` | Returns the placeholder for a delivery-type price input. |
| `getDeliveryTypeXtraPlaceholder` | Returns the placeholder for a delivery-type XTRA price input. |
| `isReturnRow` | Detects global return special-option rows. |
| `isXtraRow` | Detects global XTRA special-option rows. |
| `normalizeAutomaticXtraText` | Normalizes text used to infer automatic XTRA type. |
| `inferAutomaticXtraKind` | Detects whether an XTRA row is for indoor or first-step delivery. |
| `buildAutomaticXtraDraft` | Creates the default draft values for an automatic XTRA row. |
| `isExtraServiceRow` | Detects global extra-service special-option rows. |
| `EditPricesPage` | Main editor component. Loads price lists, switches active lists, edits rows and product settings, creates lists, and saves global price-list settings including deviation prices. |
| `updatePriceListChargeSetting` | Updates one global non-deviation charge setting field in the draft. |
| `updatePriceListDeviationSetting` | Updates one deviation customer or subcontractor price in the draft. |
