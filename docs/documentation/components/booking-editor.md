# Booking Editor

## Source

- `app/_components/Dahsboard/booking/BookingEditor.tsx`

## Responsibility

Owns booking form state, product-card pricing state, customer autofill behavior, and attachment handling for create and edit order flows.

## Functions

| Function | Description |
| --- | --- |
| `parseDistanceKm` | Extracts a positive numeric kilometer value from the driving-distance field. |
| `parseTimeWindowState` | Normalizes a stored time-window string into the preset or custom time-window state used by the form. |
| `isRecyclingReturnOption` | Detects return options such as `Retur til gjenvinning` so the editor can suppress the return-address input when the return does not go back to a store. |
| `BookingEditor` | Main booking editor container. Loads catalog and user options, manages order form state, keeps pickup autofill editable, restores the last unlocked pickup address after temporary locks, seeds customer addresses when appropriate, clears the return address when all selected return options are recycling returns, and limits required-field validation to the visible delivery date, time window, pickup address, return address, and customer phone fields. |
| `handleUploadAttachment` | Uploads a file to either pending attachment storage or an existing order and preserves the chosen attachment category. |
| `handleDeleteAttachment` | Deletes a pending attachment immediately or marks an existing order attachment for deletion after save. |
| `handleCreateOrder` | Sends the create-order request when no external submit handler is provided. |
| `handleSubmit` | Validates visible required fields, normalizes optional contact values, submits the payload, and finalizes queued attachment deletions after save. |
