// Store pickup documents (receipt / order confirmation / pickup slip) on the
// homepage white-goods order. Uploaded through
// app/api/site/white-goods-order/pickup-document and staged in the same
// PendingQuoteAttachment table + tmp/ S3 prefix as the special-goods quote
// photos (lib/orders/pendingQuoteAttachments.ts), so the same
// promote/link-on-submit helpers and the quote-photo-cleanup cron cover them.
// Shared by the client (pick-time checks) and the server (the real checks).

export const MAX_PICKUP_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, same cap as order attachments
export const MAX_PICKUP_DOCUMENT_SIZE_MB = MAX_PICKUP_DOCUMENT_SIZE_BYTES / (1024 * 1024);
// One per store stop, a stop can't exceed this many (and the per-order cap
// keeps one upload token from collecting an unbounded number of files).
export const MAX_PICKUP_STOPS = 20;
export const MAX_PICKUP_DOCUMENTS_PER_ORDER = 10;

export const PICKUP_DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";

export type PickupDocumentMimeType = "image/jpeg" | "image/png" | "application/pdf";

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((b, i) => bytes[i] === b);
}

// The server-side check: the browser-supplied Content-Type/filename is
// attacker-controlled on this public endpoint, so the bytes decide.
export function sniffPickupDocumentMimeType(bytes: Uint8Array): PickupDocumentMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, PDF_SIGNATURE)) return "application/pdf";
  return null;
}

export type PickupDocumentFileProblem = "EMPTY" | "INVALID_TYPE" | "TOO_LARGE";

const ACCEPTED_EXTENSION = /\.(pdf|jpe?g|png)$/i;
const ACCEPTED_TYPE = /^(application\/pdf|image\/jpeg|image\/png)$/i;

// Advisory pick-time check on the client, so a wrong file is flagged right
// away instead of failing at submit. Some browsers report an empty type,
// hence the extension fallback.
export function checkPickupDocumentFile(file: { name: string; type: string; size: number }): PickupDocumentFileProblem | null {
  if (!ACCEPTED_TYPE.test(file.type) && !ACCEPTED_EXTENSION.test(file.name)) return "INVALID_TYPE";
  if (file.size <= 0) return "EMPTY";
  if (file.size > MAX_PICKUP_DOCUMENT_SIZE_BYTES) return "TOO_LARGE";
  return null;
}

export function isValidPickupStopIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < MAX_PICKUP_STOPS;
}

const MAX_FILENAME_LENGTH = 160;

// What staff see in the order's attachments — "Pickup 2 - kvittering.pdf"
// says which store stop the document belongs to.
export function pickupDocumentFilename(stopIndex: number, originalName: string): string {
  const prefix = `Pickup ${stopIndex + 1} - `;
  const name = originalName.trim() || "document";
  const room = MAX_FILENAME_LENGTH - prefix.length;
  if (name.length <= room) return prefix + name;

  const dot = name.lastIndexOf(".");
  const extension = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : "";
  return prefix + name.slice(0, room - extension.length) + extension;
}

// Every pickup stop that's a store, by position (0 = the first pickup) — each
// one needs a pickup document on a new homepage order.
export function storePickupStopIndexes(sources: (string | null | undefined)[]): number[] {
  return sources.flatMap((source, i) => (source === "store" ? [i] : []));
}

// The store stops with no staged document, read back from the names
// pickupDocumentFilename gave them ("Pickup 2 - …" → stop 1).
export function stopsMissingPickupDocument(storeStops: number[], filenames: string[]): number[] {
  return storeStops.filter((stop) => !filenames.some((name) => name.startsWith(`Pickup ${stop + 1} - `)));
}

// OrderAttachment.source of a linked store pickup document.
export const PICKUP_DOCUMENT_SOURCE = "pickup-document";

// Which stop a stored document belongs to, read back from its
// pickupDocumentFilename name; null for any other name.
export function pickupDocumentStopIndex(filename: string): number | null {
  const match = /^Pickup (\d+) - /.exec(filename);
  const stop = match ? Number(match[1]) - 1 : -1;
  return stop >= 0 ? stop : null;
}
