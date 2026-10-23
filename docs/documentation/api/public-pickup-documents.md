# GET /api/public/pickup-documents/[attachmentId]

## Source

- `app/api/public/pickup-documents/[attachmentId]/route.ts`

## Responsibility

No-login link a GSM pickup task carries to a store pickup document. Verifies `?s=` with `verifyPickupDocumentLinkSignature`, loads the `OrderAttachment` only if `source = "pickup-document"`, and `302`-redirects to a fresh inline S3 signed URL (`Cache-Control: no-store`). Any failure (bad signature, attachment gone, not a pickup document) is the same plain `404`.
