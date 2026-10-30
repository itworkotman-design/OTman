// path: lib/integrations/gsm/receiptUploads.ts
import type { GsmReceipt } from "@/lib/integrations/gsm/sendReceipts";
import { PICKUP_DOCUMENT_SOURCE, pickupDocumentStopIndex } from "@/lib/orders/pickupDocuments";

export type ReceiptAttachment = GsmReceipt & {
  category: string;
  source: string | null;
};

export type ReceiptTask = {
  gsmTaskId: string;
  category: "pick_up" | "drop_off" | "assignment" | null;
  // The task's address as GSM has it, null when GSM didn't return one.
  rawAddress?: string | null;
};

export type PickupStopAddress = { stop: number; address: string };

function sameAddress(a: string, b: string) {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/**
 * Which files go on which GSM task:
 * - Dashboard RECEIPT attachments: drop-off and assignment only.
 * - A homepage order's store pickup documents ("Pickup N - …"): the pick-up
 *   task of their own stop, plus every drop-off and assignment task.
 *
 * GSM returns tasks in any order, so a pick-up task's stop is found by its
 * address. A document whose stop matches no pick-up task (stops edited since
 * the upload, GSM changed the address text, or no stop in the name) goes on
 * every pick-up task instead of getting lost.
 */
export function planReceiptUploads(params: {
  tasks: ReceiptTask[];
  attachments: ReceiptAttachment[];
  pickupStops: PickupStopAddress[];
}): Array<{ gsmTaskId: string; receipts: GsmReceipt[] }> {
  const { tasks, attachments, pickupStops } = params;

  const stopsOfTask = (task: ReceiptTask) =>
    task.category === "pick_up" && task.rawAddress
      ? pickupStops.filter((stop) => sameAddress(stop.address, task.rawAddress!)).map((stop) => stop.stop)
      : [];

  const matchedStops = new Set(tasks.flatMap(stopsOfTask));

  const goesToTask = (attachment: ReceiptAttachment, task: ReceiptTask) => {
    if (task.category === "drop_off" || task.category === "assignment") return true;
    if (task.category !== "pick_up" || attachment.source !== PICKUP_DOCUMENT_SOURCE) return false;

    const stop = pickupDocumentStopIndex(attachment.filename);
    if (stop === null || !matchedStops.has(stop)) return true;
    return stopsOfTask(task).includes(stop);
  };

  return tasks.flatMap((task) => {
    const receipts = attachments
      .filter((attachment) => goesToTask(attachment, task))
      .map(({ id, filename, mimeType, storagePath }) => ({ id, filename, mimeType, storagePath }));

    return receipts.length > 0 ? [{ gsmTaskId: task.gsmTaskId, receipts }] : [];
  });
}
