# Booking Editor

## Source

- `app/_components/Dahsboard/booking/BookingEditor.tsx`

## Responsibility

Owns booking form state, including file uploads before and after an order exists.

## Functions

| Function | Description |
| --- | --- |
| `parseDistanceKm` | Extracts a positive numeric kilometer value from the driving-distance field. |
| `BookingEditor` | Main booking editor container. Manages order form state, attachment state, upload/delete handlers, and final submit flow. |
| `handleUploadAttachment` | Uploads a file to either the pending-attachment route or the order-specific attachment route and now includes the selected file category. |
| `handleDeleteAttachment` | Removes a file from pending storage or marks an existing order attachment for deletion. |
| `handleSubmit` | Validates the form, submits the order payload, and finalizes attachment deletions after save. |
