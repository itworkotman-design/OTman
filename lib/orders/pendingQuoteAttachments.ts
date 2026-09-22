import type { PrismaClient } from "@prisma/client";

// Same "upload before the parent record exists" shape as
// PendingOrderAttachment/linkPendingAttachmentsForSessionId
// (lib/orders/createOrder.ts), scoped by a client-generated random token
// instead of an authenticated staff session id — see
// prisma/schema.prisma's PendingQuoteAttachment model comment and
// docs/homepage-ordering-roadmap.md §5.

export const MAX_QUOTE_PHOTOS = 6;
export const MAX_QUOTE_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, same cap as order attachments

// crypto.randomUUID() format — what the client generates. Validated before
// it's ever used in an S3 key or a DB query, even though it's not a secret
// (it's not used for authorization, only for grouping uploads together).
const QUOTE_TOKEN_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidQuoteToken(token: string | null | undefined): token is string {
  return typeof token === "string" && QUOTE_TOKEN_FORMAT.test(token);
}

// Real, defensive-in-depth file-type check — every existing upload path in
// this app (order attachments, blog images) only checks the browser-supplied
// Content-Type/filename, which is trivially spoofable. This is a public,
// unauthenticated endpoint, so it checks the actual bytes instead. Only the
// 3 formats a "photo" upload should ever legitimately be.
export function sniffImageMimeType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

type QuoteAttachmentClient = Pick<PrismaClient, "pendingQuoteAttachment" | "orderAttachment">;

// Copies every PendingQuoteAttachment row for this token into a real
// OrderAttachment on the newly-created order, then deletes the pending rows
// — mirrors linkPendingAttachmentsForSessionId exactly, just keyed
// differently. Returns how many were linked.
export async function linkPendingQuoteAttachments(
  client: QuoteAttachmentClient,
  params: { orderId: string; quoteToken: string },
): Promise<number> {
  const pending = await client.pendingQuoteAttachment.findMany({
    where: { quoteToken: params.quoteToken },
  });

  if (pending.length === 0) {
    return 0;
  }

  for (const attachment of pending) {
    await client.orderAttachment.create({
      data: {
        orderId: params.orderId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        storagePath: attachment.storagePath,
        category: "ATTACHMENT",
      },
    });
  }

  await client.pendingQuoteAttachment.deleteMany({
    where: { quoteToken: params.quoteToken },
  });

  return pending.length;
}
