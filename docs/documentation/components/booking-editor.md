# Booking Editor

## Source

- `app/_components/Dahsboard/booking/BookingEditor.tsx`

## Responsibility

Owns booking form state, product-card pricing state, customer autofill behavior, legacy field normalization for imported orders, and attachment handling for create and edit order flows. Existing orders use the saved pricing snapshot until the user applies current catalog prices, so price-list changes do not silently change saved orders. Native manual adjustments support discounts, extras, subcontractor minus, subcontractor plus, hardcoded order-level fee lines, priced deviation rows, and priced extra-pickup rows. Imported WordPress orders keep their incoming KM price until the route or KM value is edited. The admin price-list selector displays only the price-list name, treats the selected list as authoritative, and ignores stale or mismatched catalog responses when the selected list changes.

## Functions

| Function | Description |
| --- | --- |
| `parseDistanceKm` | Extracts a positive numeric kilometer value from the driving-distance field. |
| `normalizeRouteAddress` | Normalizes route address strings for imported WordPress route-change comparisons. |
| `normalizeExtraPickupAddresses` | Builds a stable comparison key for extra-pickup addresses. |
| `parseTimeWindowState` | Normalizes a stored time-window string into the preset or custom time-window state used by the form. |
| `normalizeInitialDeliveryDate` | Converts legacy imported delivery dates into the editor's `YYYY-MM-DD` input format before state hydration. |
| `normalizeInitialTimeWindow` | Converts spaced legacy time windows into the editor's canonical range format before preset or custom parsing runs. |
| `normalizeInitialLift` | Maps imported lift values such as `JA` and `NEI` onto the editor's `yes` and `no` radio values. |
| `normalizeInitialStatus` | Maps imported WordPress status labels onto the editor's canonical lowercase status keys. |
| `isCancelledOrFailedStatus` | Detects statuses that should automatically discount all non-protected order charges. |
| `removeProtectedAutoDiscountItems` | Removes deviation, extra-work, and add-to-order fee lines before calculating the automatic cancellation or failure discount. |
| `formatAutoDiscountAmount` | Formats the automatic status discount as the plain numeric string stored in the `rabatt` field. |
| `isRecyclingReturnOption` | Detects return options such as `Retur til gjenvinning` so the editor can suppress the return-address input when the return does not go back to a store. |
| `BookingEditor` | Main booking editor container. Loads catalog and user options, manages order form state, hydrates saved price snapshots, shows a price-change warning for existing orders when current catalog prices differ, lets the user opt into the new prices, reloads catalog pricing for the admin-selected price list while aborting stale catalog requests and rejecting mismatched catalog responses, recalculates driving distance from pickup, extra pickups, delivery, and return addresses through the route-distance API, adds priced deviation and extra-pickup rows, keeps imported WordPress KM price untouched until route or KM edits occur, adds hardcoded extra-work and add-to-order fees to the calculator, automatically sets `rabatt` for cancelled or failed orders to discount everything except deviation, extra-work, and add-to-order fees, preserves the stored `expressDelivery` value for existing orders while still auto-enabling it for new short-notice bookings, clears the return address when all selected return options are recycling returns, defaults empty extra-pickup phone inputs to `+47`, passes the over-100-km delivery override into product pricing, scrolls to the top after a successful save, and jumps to the first invalid field when required or contact validation fails. |
| `handleUploadAttachment` | Uploads a file to either pending attachment storage or an existing order and preserves the chosen attachment category. |
| `handleDeleteAttachment` | Deletes a pending attachment immediately or marks an existing order attachment for deletion after save. |
| `handleCreateOrder` | Sends the create-order request when no external submit handler is provided. |
| `handleUseCurrentPrices` | Replaces the saved pricing snapshot on all product cards with the currently loaded catalog prices. |
| `handleSubmit` | Validates visible required fields into per-field error state, snapshots the applied calculator prices into every product card, scrolls to the first invalid input when validation fails, normalizes optional contact values, submits native manual adjustment and hardcoded fee fields, finalizes queued attachment deletions after save, and scrolls the page back to the top on success. |
