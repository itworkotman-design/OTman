# Orders Send To GSM Route

## Source

- `app/api/orders/send-to-gsm/route.ts`

## Responsibility

Validates the caller, loads the selected orders with their `items`, sends them to GSM while keeping OTman GSM ids and task references in sync, and writes successful GSM sends into order history plus last-edited metadata.

## Functions

| Function | Description |
| --- | --- |
| `POST` | Validates access, skips already-synced orders unless `force` is enabled, loads each order with `items`, sends it to GSM, persists the returned GSM order/task ids, updates last-edited metadata, and writes a GSM send action into order history. Then uploads the order's receipt files to the returned GSM tasks via `sendReceiptsToGsmTask` (see `receiptGoesToTask`); a receipt failure is reported as `receiptError` on that order's result without failing the send, and `receiptsSent` counts newly attached documents. |
| `receiptGoesToTask` | Which tasks get which file. Dashboard `RECEIPT` attachments go to the `drop_off` and `assignment` tasks only (never `pick_up`). A homepage order's store pickup documents (`OrderAttachment.source = "pickup-document"`, uploaded by the customer in the booking flow) go to every task: `pick_up`, `drop_off` and `assignment`, so the driver can show the cashier the receipt at pick-up. |
