# GSM receipt uploads

## Source

- `lib/integrations/gsm/receiptUploads.ts`

## Responsibility

Decides which receipt files go on which GSM task when an order is sent to GSM (`app/api/orders/send-to-gsm/route.ts`). The upload itself is `sendReceiptsToGsmTask` (`gsm-send-receipts.md`).

## Functions

| Function | Description |
| --- | --- |
| `planReceiptUploads({ tasks, attachments, pickupStops })` | Returns `{ gsmTaskId, receipts }` per task that gets at least one file (only the file fields `id`/`filename`/`mimeType`/`storagePath`). Dashboard `RECEIPT` attachments go on every `drop_off` and `assignment` task, never `pick_up`. A homepage order's store pickup documents (`source = "pickup-document"`, named `Pickup N - …`) go on the `pick_up` task of their own stop, plus every `drop_off` and `assignment` task. |

## Matching pick-up tasks to stops

GSM returns tasks in any order, so a pick-up task's stop is found by comparing its `rawAddress` (read back by `sendOrderToGsm`) with `pickupStopAddresses(order)` (`gsm-build-order-payload.md`), ignoring case and surrounding spaces. A document whose stop matches no pick-up task goes on every pick-up task instead of getting lost. That happens when stops were edited after the upload, GSM changed the address text, or the filename has no stop number.
