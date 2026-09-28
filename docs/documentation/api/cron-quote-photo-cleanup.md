# `app/api/cron/quote-photo-cleanup/route.ts`

`POST`, bearer `CRON_SECRET` (same as the other `app/api/cron/*` routes).
Deletes special-goods quote photos staged >24h ago that never became part of
an order (S3 object + `PendingQuoteAttachment` row) via
`cleanupExpiredPendingQuoteAttachments`. Returns
`{ ok, scanned, filesDeleted, rowsDeleted }`; processes up to 500 rows per
call. Schedule it daily with the external scheduler. Backstop to the S3
lifecycle rule on `tmp/`, which can't clean the DB rows.
