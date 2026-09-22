# `app/api/site/special-goods-quote/upload/route.ts`

## Purpose
Public, unauthenticated photo upload for the special/other-goods
quote-request flow (`SpecialGoodsQuoteFlow.tsx`). The one genuinely new
public attack surface added in this repo's homepage-ordering work — every
other upload path here (order attachments, blog images, archive docs)
requires a logged-in dashboard session, so nothing existing was safe to
reuse as-is. See `docs/homepage-ordering-roadmap.md` §5 for the full
decision log (including why real CAPTCHA was deliberately deferred).

Every check here is deliberate defense in depth, layered in this order:
1. `requestTooLargeByContentLength` (pre-body Content-Length check, before
   anything is buffered — reused from the Archive package's own upload gate,
   `lib/docArchive/uploadGate.ts`).
2. Per-IP rate limit (`lib/auth/rateLimit.ts`'s DB-backed sliding-window
   limiter, previously only used for login/password-reset abuse prevention —
   reused here keyed by IP instead of by user; 20/hour). This is the only
   per-IP limiter anywhere in the app — every other public `/api/site/*`
   route only has a weak process-global in-memory counter.
3. `quoteToken` format validation (`isValidQuoteToken`).
4. Per-token photo count cap (`MAX_QUOTE_PHOTOS`, 6).
5. Post-buffer size re-check (`MAX_QUOTE_PHOTO_SIZE_BYTES`).
6. Real file-content validation (`sniffImageMimeType` — magic bytes, not the
   spoofable browser-supplied `Content-Type`). **The stored `contentType` is
   the sniffed value, never the client's claim.**

Uploads land in `PendingQuoteAttachment` rows (grouped by `quoteToken`),
linked into real `OrderAttachment` rows on final submission — see
`lib/orders/pendingQuoteAttachments.ts`.

## Functions
- `POST` — validates + uploads to S3 (`uploadAttachmentBufferToS3`, reused
  from `lib/orders/orderAttachmentStorage.ts`), returns `{ ok, id, filename }`.
- `DELETE` — removes one pending upload; scoped by matching **both** `id`
  and `quoteToken` (the token is this flow's only notion of "ownership" —
  there's no real auth for an anonymous visitor).
