# GSM Download POD PDF

## Source

- `lib/integrations/gsm/downloadPodPdf.ts`

## Responsibility

Downloads GSM proof-of-delivery PDFs after completed task webhooks, retries while GSM finalizes the PDF, stores the newest usable PDF through S3 attachment storage when configured, falls back to local `/uploads` storage in development, and replaces any previous POD attachment for the same order/task/document id.

## Functions

| Function | Description |
| --- | --- |
| `sleep` | Waits between POD fetch attempts so GSM has time to finalize the generated PDF. |
| `fetchPodPdfBuffer` | Authenticates to GSM and downloads the POD PDF bytes for a task. |
| `buildPaths` | Builds the local upload directory paths used only when S3 attachment storage is not configured. |
| `writePodPdf` | Stores the POD PDF in S3 when configured, otherwise writes it to local public uploads. |
| `syncPodPdfWithRetry` | Downloads the best available POD PDF, upserts the GSM attachment record, and deletes the previous stored object/file when replacing an existing POD. |
