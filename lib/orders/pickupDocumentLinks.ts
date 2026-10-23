import { createHmac, timingSafeEqual } from "crypto";
import { pickupDocumentStopIndex } from "./pickupDocuments";

// Stable, shareable links to a store pickup document, put in the GSM pickup
// task so the driver can show the cashier the receipt / order confirmation.
// An S3 signed URL can't be used directly — it expires (minutes, at most 7
// days) long before a delivery weeks out — so the link points at
// app/api/public/pickup-documents/[attachmentId], which checks an HMAC of
// the attachment id and redirects to a fresh S3 link. No expiry: the link
// stops working once the attachment is deleted (or the secret rotated).

function secret(): string | null {
  return process.env.ATTACHMENT_LINK_SECRET?.trim() || null;
}

export function pickupDocumentLinkSignature(attachmentId: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(`pickup-document:${attachmentId}`).digest("base64url");
}

export function verifyPickupDocumentLinkSignature(attachmentId: string, signature: string): boolean {
  const expected = pickupDocumentLinkSignature(attachmentId);
  if (!expected || !signature) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type PickupDocumentLink = {
  // The pickup stop (0 = first) the document was uploaded for; null when the
  // name doesn't say.
  stopIndex: number | null;
  filename: string;
  // null when links can't be built (ATTACHMENT_LINK_SECRET or
  // ORDER_ACTION_BASE_URL not configured).
  url: string | null;
};

export function buildPickupDocumentLinks(attachments: { id: string; filename: string }[]): PickupDocumentLink[] {
  const baseUrl = process.env.ORDER_ACTION_BASE_URL?.trim().replace(/\/+$/, "") || null;

  return attachments.map((attachment) => {
    const signature = pickupDocumentLinkSignature(attachment.id);
    return {
      stopIndex: pickupDocumentStopIndex(attachment.filename),
      filename: attachment.filename,
      url:
        baseUrl && signature
          ? `${baseUrl}/api/public/pickup-documents/${encodeURIComponent(attachment.id)}?s=${signature}`
          : null,
    };
  });
}
