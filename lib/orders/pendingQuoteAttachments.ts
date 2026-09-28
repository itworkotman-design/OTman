import type { PrismaClient } from "@prisma/client";

// Same "upload before the parent record exists" shape as
// PendingOrderAttachment/linkPendingAttachmentsForSessionId
// (lib/orders/createOrder.ts), scoped by a client-generated random token
// instead of an authenticated staff session id — see
// prisma/schema.prisma's PendingQuoteAttachment model comment and
// docs/homepage-ordering-roadmap.md §5.

export const MAX_QUOTE_PHOTOS = 5;
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
// formats a "photo" upload should ever legitimately be: JPEG/PNG/WebP plus
// HEIC/HEIF, which is what iPhones (and some Androids) save photos as.
export type SniffedImageMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "image/heif";

// ISO-BMFF `ftyp` major brands that identify a still HEIC/HEIF image. Other
// ftyp files (MP4 = isom/mp42, MOV = qt, AVIF, ...) are deliberately excluded.
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis"]);
const HEIF_BRANDS = new Set(["mif1", "msf1"]);

export function sniffImageMimeType(bytes: Uint8Array): SniffedImageMimeType | null {
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (HEIC_BRANDS.has(brand)) return "image/heic";
    if (HEIF_BRANDS.has(brand)) return "image/heif";
    return null;
  }

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

const TEMP_STORAGE_PREFIX = "s3://tmp/";

// Moves every still-staged (tmp/) photo for this token to its permanent
// orders/ key and records the new path on the pending row. Called BEFORE the
// order row is created so a failed copy aborts the submission cleanly instead
// of leaving an order pointing at photos that never made it. Idempotent: rows
// already promoted by an earlier, partially-failed attempt are skipped, so the
// customer can simply resubmit. `promote` is injected (defaults to the S3
// implementation) so this stays unit-testable. Returns how many rows it moved.
export async function promotePendingQuoteAttachments(
  client: Pick<PrismaClient, "pendingQuoteAttachment">,
  params: { quoteToken: string; promote: (storagePath: string) => Promise<string> },
): Promise<number> {
  const pending = await client.pendingQuoteAttachment.findMany({
    where: { quoteToken: params.quoteToken },
    select: { id: true, storagePath: true },
  });

  let moved = 0;
  for (const attachment of pending) {
    if (!attachment.storagePath.startsWith(TEMP_STORAGE_PREFIX)) continue;

    const storagePath = await params.promote(attachment.storagePath);
    await client.pendingQuoteAttachment.update({
      where: { id: attachment.id },
      data: { storagePath },
    });
    moved++;
  }

  return moved;
}

const CLEANUP_BATCH_SIZE = 500;

// Removes staged photos that were never attached to an order (visitor left,
// bot hit the upload endpoint directly, order creation failed): deletes the
// S3 object, then the row. Backstop to the S3 lifecycle rule on tmp/ — that
// rule can't touch these DB rows. A row whose path an OrderAttachment already
// references (a crash between link steps) has its file left alone; only the
// stale row goes.
export async function cleanupExpiredPendingQuoteAttachments(
  client: Pick<PrismaClient, "pendingQuoteAttachment" | "orderAttachment">,
  params: { now: Date; maxAgeMs: number; deleteFile: (storagePath: string) => Promise<void> },
): Promise<{ scanned: number; filesDeleted: number; rowsDeleted: number }> {
  const cutoff = new Date(params.now.getTime() - params.maxAgeMs);
  const expired = await client.pendingQuoteAttachment.findMany({
    where: { createdAt: { lt: cutoff } },
    take: CLEANUP_BATCH_SIZE,
  });

  if (expired.length === 0) {
    return { scanned: 0, filesDeleted: 0, rowsDeleted: 0 };
  }

  let filesDeleted = 0;
  for (const attachment of expired) {
    const referenced = await client.orderAttachment.findFirst({
      where: { storagePath: attachment.storagePath },
      select: { id: true },
    });
    if (referenced) continue;

    await params.deleteFile(attachment.storagePath);
    filesDeleted++;
  }

  const { count } = await client.pendingQuoteAttachment.deleteMany({
    where: { id: { in: expired.map((a) => a.id) } },
  });

  return { scanned: expired.length, filesDeleted, rowsDeleted: count };
}

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
