# POST /api/site/white-goods-order/pickup-document

## Source

- `app/api/site/white-goods-order/pickup-document/route.ts`

## Responsibility

Public, unauthenticated upload of a store pickup document (receipt / order confirmation) for the homepage white-goods order. Multipart fields: `file`, `uploadToken` (client `crypto.randomUUID()`), `stopIndex` (0 = first pickup). The client only calls it right before submitting the order (`WhiteGoodsBookingFlow`'s `uploadPickupDocuments`).

Checks, in order: Content-Length (`413 FILE_TOO_LARGE`), per-IP rate limit (20/day, `429 RATE_LIMITED`), token format (`INVALID_TOKEN`), stop index (`INVALID_STOP`), file present (`FILE_REQUIRED`), size ≤ 10 MB (`413 FILE_TOO_LARGE`), ≤ 10 files per token (`TOO_MANY_FILES`), and the real bytes must be PDF/JPEG/PNG (`sniffPickupDocumentMimeType`, `INVALID_FILE_TYPE`).

Stored under `tmp/pickup-documents/<token>/…` in S3 and as a `PendingQuoteAttachment` row named `Pickup N - <original name>`. `POST /api/site/white-goods-order` with `pickupDocumentToken` promotes and links them; anything never submitted is removed by the S3 `tmp/` lifecycle rule and `app/api/cron/quote-photo-cleanup`.
