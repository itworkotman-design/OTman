# Orders Send To GSM Route

## Source

- `app/api/orders/send-to-gsm/route.ts`

## Responsibility

Validates the caller, loads the selected orders with their `items`, sends them to GSM while keeping OTman GSM ids and task references in sync, and writes successful GSM sends into order history plus last-edited metadata.

## Functions

| Function | Description |
| --- | --- |
| `POST` | Validates access, skips already-synced orders unless `force` is enabled, loads each order with `items`, sends it to GSM, persists the returned GSM order/task ids, updates last-edited metadata, and writes a GSM send action into order history. Then uploads the order's `RECEIPT` attachments and store pickup documents to the returned GSM tasks via `sendReceiptsToGsmTask`, as planned by `planReceiptUploads` (see `integrations/gsm-receipt-uploads.md`); a receipt failure is reported as `receiptError` on that order's result without failing the send, and `receiptsSent` counts newly attached documents. |
