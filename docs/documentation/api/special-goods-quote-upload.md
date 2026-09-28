# `app/api/site/special-goods-quote/upload/route.ts`

## Purpose
Public, unauthenticated photo upload for the special/other-goods
quote-request flow (`SpecialGoodsQuoteFlow.tsx`). The one genuinely new
public attack surface added in this repo's homepage-ordering work — every
other upload path here (order attachments, blog images, archive docs)
requires a logged-in dashboard session, so nothing existing was safe to
reuse as-is. See `docs/homepage-ordering-roadmap.md` §5 for the full
decision log (including why real CAPTCHA was deliberately deferred).

**Only called at final submit**, not as each photo is picked —
`SpecialGoodsQuoteFlow.tsx` holds photos as plain `File` objects in memory
until "Request a quote" is clicked, then uploads them here one by one. This
means there's no `DELETE` handler (removing a photo before submit is purely
local state, never touches this endpoint) and, more importantly, no
orphaned S3 objects/DB rows from someone who picks photos and abandons the
form — the risk that originally motivated a "cleanup cron" follow-up no
longer needs one for that case.

Every check here is deliberate defense in depth, layered in this order:
1. `requestTooLargeByContentLength` (pre-body Content-Length check, before
   anything is buffered — reused from the Archive package's own upload gate,
   `lib/docArchive/uploadGate.ts`).
2. Per-IP rate limit (`lib/auth/rateLimit.ts`'s DB-backed sliding-window
   limiter, previously only used for login/password-reset abuse prevention —
   reused here keyed by IP instead of by user). **5 uploads per IP per day**
   — deliberately equal to `MAX_QUOTE_PHOTOS`, so one IP gets at most one
   quote's worth of photos per day, across any number of quote requests.
   This is the only per-IP limiter anywhere in the app — every other public
   `/api/site/*` route only has a weak process-global in-memory counter.
3. `quoteToken` format validation (`isValidQuoteToken`).
4. Per-token photo count cap (`MAX_QUOTE_PHOTOS`, 5).
5. Post-buffer size re-check (`MAX_QUOTE_PHOTO_SIZE_BYTES`).
6. Real file-content validation (`sniffImageMimeType` — JPEG/PNG/WebP/HEIC/HEIF magic bytes, not the
   spoofable browser-supplied `Content-Type`). **The stored `contentType` is
   the sniffed value, never the client's claim.**

Uploads land in `PendingQuoteAttachment` rows (grouped by `quoteToken`),
linked into real `OrderAttachment` rows on final submission — see
`lib/orders/pendingQuoteAttachments.ts`.

## Functions
- `POST` — validates + uploads to S3 (`uploadAttachmentBufferToS3`, reused
  from `lib/orders/orderAttachmentStorage.ts`), returns `{ ok, id, filename }`.

## Temp staging (added 2026-09-28)
Photos are written by `uploadTempAttachmentBufferToS3` to
`tmp/quote-requests/<quoteToken>/...` in the same bucket, **not** `orders/`.
The submission route (`../special-goods-quote/route.ts`) promotes them to
`orders/...` (`promoteTempAttachmentToOrders`) right before creating the
order — a failed copy aborts the submission with nothing created. Anything
never promoted is removed by the S3 lifecycle rule on `tmp/` (**infra setup
required**: expire objects with prefix `tmp/` after 1 day) and by
`app/api/cron/quote-photo-cleanup`, which also deletes the stale
`PendingQuoteAttachment` rows the lifecycle rule can't reach.
