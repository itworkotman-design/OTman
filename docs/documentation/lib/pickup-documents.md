# `lib/orders/pickupDocuments.ts`

Shared (client + server) rules for store pickup documents on the homepage white-goods order. They reuse the `PendingQuoteAttachment` staging of `pendingQuoteAttachments.ts`, so the quote-photo cleanup cron covers them.

- `MAX_PICKUP_DOCUMENT_SIZE_BYTES` (10 MB), `MAX_PICKUP_DOCUMENTS_PER_ORDER` (10), `MAX_PICKUP_STOPS`, `PICKUP_DOCUMENT_ACCEPT` (file input `accept`).
- `sniffPickupDocumentMimeType(bytes)` — PDF/JPEG/PNG from magic bytes, else `null` (server check).
- `checkPickupDocumentFile({ name, type, size })` — advisory pick-time check: `INVALID_TYPE` / `EMPTY` / `TOO_LARGE` / `null`.
- `storePickupStopIndexes(sources)`, `stopsMissingPickupDocument(storeStops, filenames)` — the order route's "every store stop has a document" check.
- `isValidPickupStopIndex(n)`, `pickupDocumentFilename(stopIndex, name)` — `Pickup N - name`, capped at 160 chars keeping the extension.

Client counterpart: `app/_components/site/BookingModal/whiteGoods/pickupDocumentUploads.ts` (`collectPickupDocuments`, `hasEveryStorePickupDocument` — gates the pickup step on new orders, `planPickupDocumentUploads` — retry-safe: only uploads what's new, or restarts under a fresh token when an already-sent file was removed/replaced).

While submitting, the flow uploads through `postWithUploadProgress` (XHR, since fetch has no upload progress) and the submit button shows `describeSubmitProgress` ("Laster opp dokument 1 av 2… 45 %", then "Sender bestillingen…") with a spinner, a "don't close the page" note, and a `beforeunload` prompt. A bare `413` (Vercel's 4.5 MB request limit) is shown as the "file too large" error.
