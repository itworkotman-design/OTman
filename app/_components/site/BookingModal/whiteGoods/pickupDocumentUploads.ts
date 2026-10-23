import type { PickupSource } from "./PickupSourceStep";

// Store pickup documents are held client-side (plain File objects) until the
// final submit, then uploaded to app/api/site/white-goods-order/pickup-document
// under one upload token and linked to the order by the order POST. Nothing
// is sent for an abandoned form.
export type PickupDocumentUpload = { stopIndex: number; file: File };

// One entry per store stop that has a document, numbered by the stop's
// position (0 = the first pickup). A document picked while a stop was a
// store, which has since been switched to private/business, is left out.
export function collectPickupDocuments(
  stops: { source: PickupSource | null; document: File | null }[],
): PickupDocumentUpload[] {
  return stops.flatMap((stop, stopIndex) =>
    stop.source === "store" && stop.document ? [{ stopIndex, file: stop.document }] : [],
  );
}

const same = (a: PickupDocumentUpload, b: PickupDocumentUpload) => a.file === b.file && a.stopIndex === b.stopIndex;

// A failed submit (price changed, network) leaves already-uploaded documents
// staged under the token, and the order POST links EVERY staged file for it.
// So a retry only uploads what's new — unless something already sent is no
// longer wanted (removed, replaced, moved to another stop): then everything
// goes again under a fresh token, and the abandoned token's files are swept
// by the quote-photo-cleanup cron.
export function planPickupDocumentUploads(
  wanted: PickupDocumentUpload[],
  sent: PickupDocumentUpload[],
): { freshToken: boolean; toUpload: PickupDocumentUpload[] } {
  const allSentStillWanted = sent.every((s) => wanted.some((w) => same(w, s)));
  if (!allSentStillWanted) return { freshToken: true, toUpload: wanted };
  return { freshToken: false, toUpload: wanted.filter((w) => !sent.some((s) => same(w, s))) };
}

// The document is required for every store stop on a new order — the pickup
// step doesn't complete until each one has a (pick-time checked) file.
export function hasEveryStorePickupDocument(stops: { source: PickupSource | null; document: File | null }[]): boolean {
  return stops.every((stop) => stop.source !== "store" || stop.document !== null);
}
