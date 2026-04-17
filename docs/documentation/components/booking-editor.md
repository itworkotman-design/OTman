# Booking Editor

## Source

- `app/_components/Dahsboard/booking/BookingEditor.tsx`

## Responsibility

Owns booking form state, including file uploads before and after an order exists.

## Functions

| Function | Description |
| --- | --- |
| `parseDistanceKm` | Extracts a positive numeric kilometer value from the driving-distance field. |
| `parseTimeWindowState` | Normalizes a stored time-window string into either a preset selection or the custom `from/to` values used by the form. |
| `BookingEditor` | Main booking editor container. Manages order form state, product cards, attachment state, upload/delete handlers, and final submit flow. Product cards now carry their own optional `modelNumber` values, while the editor still keeps the legacy top-level `modelNr` field for payload compatibility. It also restores saved custom time windows correctly, persists the custom `Contact customer?` flag together with its optional contact note, clears `lift` when `floorNo` is empty, and submits an empty lift value for floor-less orders. |
| `handleUploadAttachment` | Uploads a file to either the pending-attachment route or the order-specific attachment route and now includes the selected file category. |
| `handleDeleteAttachment` | Removes a file from pending storage or marks an existing order attachment for deletion. |
| `handleSubmit` | Validates the form, submits the order payload, and finalizes attachment deletions after save. When `Contact customer?` is checked for a custom time window, it persists the checkbox state and optional contact note while also forcing `dontSendEmail` on the submitted payload. |
