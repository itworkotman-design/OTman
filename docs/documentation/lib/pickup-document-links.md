# `lib/orders/pickupDocumentLinks.ts`

Stable links to store pickup documents for the GSM pickup tasks, so drivers can show the cashier the receipt / order confirmation. S3 signed URLs expire too soon for deliveries weeks out, so the link is `${ORDER_ACTION_BASE_URL}/api/public/pickup-documents/<attachmentId>?s=<HMAC>`, which redirects to a fresh S3 link.

- `pickupDocumentLinkSignature(attachmentId)` — HMAC-SHA256 (base64url) with `ATTACHMENT_LINK_SECRET`; `null` when the secret isn't set.
- `verifyPickupDocumentLinkSignature(attachmentId, signature)` — constant-time check; always `false` without a secret.
- `buildPickupDocumentLinks(attachments)` — `{ stopIndex, filename, url }` per attachment (`stopIndex` from the `Pickup N - …` name, `url` `null` when the secret or base URL is missing).

No expiry: a link stops working when the attachment is deleted or the secret is rotated.
