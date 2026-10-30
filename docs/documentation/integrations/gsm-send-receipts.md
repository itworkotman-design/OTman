# GSM Send Receipts

## Source

- `lib/integrations/gsm/sendReceipts.ts`

## Responsibility

Attaches an order's receipts to a GSM task as GSM Documents, visible to the driver in the mobile app (`visible_to_worker: true`) but not to the customer (`visible_to_client: false`).

Only `RECEIPT` attachments are sent. `ATTACHMENT` rows include the POD PDF pulled back from GSM (`gsmDocumentId: "pod:<taskId>"`), so pushing them would send GSM its own files.

Upload flow:

1. `POST /file_uploads/` (`file_name`, `file_type`) returns an `s3_signature` (`url` + `fields`).
2. Multipart `POST` of the file to that S3 URL (signature fields first, `file` last).
3. `POST /documents/` linking `task` and `file_upload`, with `external_id: "receipt:<attachmentId>:<taskId>"` (GSM treats `external_id` as unique per account and updates the existing document on a repeat POST, so without the task id the second task would just take over the first task's document).

Resends are idempotent: before uploading, the task's documents are listed (`GET /documents/?task=<id>`) and receipts whose `external_id` is already present are skipped. GSM's `external_id` is used for this instead of our `OrderAttachment.gsmDocumentId`, which marks rows that came *from* GSM and is matched by the POD backfill scripts.

## Functions

| Function | Description |
| --- | --- |
| `sendReceiptsToGsmTask` | Uploads every receipt not already on the task and returns `{ sent, skipped }`. Throws on the first failed upload. |
| `readReceiptBytes` | Reads the receipt from S3, or from `public/` for legacy `/uploads/...` paths. |
| `uploadReceipt` | Runs the three-step upload above for one receipt. |
