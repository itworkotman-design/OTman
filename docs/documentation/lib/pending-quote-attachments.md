# `lib/orders/pendingQuoteAttachments.ts`

## Purpose
Backs the public "Andre varer"/"Spesialvarer" (special/other goods)
quote-request photo upload — the one genuinely new public attack surface
added in this step (a public, unauthenticated file upload; every other
upload path in this app requires a dashboard session). See
`docs/homepage-ordering-roadmap.md` §5 for the full decision log.

Same "upload before the parent record exists" shape as
`PendingOrderAttachment`/`linkPendingAttachmentsForSessionId`
(`lib/orders/createOrder.ts`), but scoped by a client-generated random token
(`quoteToken`, a `crypto.randomUUID()`) instead of an authenticated staff
session id, since there's no such session for an anonymous visitor. The
token isn't a secret and isn't used for authorization beyond "same token can
manage its own uploads before submission" — real defense is the upload
route's own rate limiting + file-content validation (see
`app/api/site/special-goods-quote/upload/route.ts`'s own doc/comments).

## Functions
- `isValidQuoteToken(token)` — format guard (a real UUID string), checked
  before the token is ever used in an S3 key or DB query.
- `sniffImageMimeType(bytes)` — magic-byte check for JPEG/PNG/WEBP. The real
  file-type validation: every OTHER upload path in this app only checks the
  browser-supplied (trivially spoofable) `Content-Type`/filename.
- `linkPendingQuoteAttachments(client, { orderId, quoteToken })` — copies
  every pending row for the token into a real `OrderAttachment`, deletes the
  pending rows, returns how many were linked. Mirrors
  `linkPendingAttachmentsForSessionId` exactly, just keyed differently.
- `MAX_QUOTE_PHOTOS` (6), `MAX_QUOTE_PHOTO_SIZE_BYTES` (10 MB, same cap as
  order attachments).
