import { describe, expect, it } from "vitest";
import { planReceiptUploads, type ReceiptAttachment } from "./receiptUploads";

const receipt: ReceiptAttachment = {
  id: "r1",
  filename: "receipt.pdf",
  mimeType: "application/pdf",
  storagePath: "s3://r1",
  category: "RECEIPT",
  source: null,
};

function pickupDocument(id: string, stop: number): ReceiptAttachment {
  return {
    id,
    filename: `Pickup ${stop + 1} - kvittering.pdf`,
    mimeType: "application/pdf",
    storagePath: `s3://${id}`,
    category: "ATTACHMENT",
    source: "pickup-document",
  };
}

const file = ({ id, filename, mimeType, storagePath }: ReceiptAttachment) => ({ id, filename, mimeType, storagePath });

const pickupStops = [
  { stop: 0, address: "Elkjøp Lørenskog, Solheimveien 7" },
  { stop: 1, address: "Power Alnabru, Strømsveien 245" },
];

// GSM returns tasks in any order; pick-up tasks are told apart by address.
const tasks = [
  { gsmTaskId: "assign", category: "assignment" as const, rawAddress: "Kundeveien 1" },
  { gsmTaskId: "pick-2", category: "pick_up" as const, rawAddress: "Power Alnabru, Strømsveien 245" },
  { gsmTaskId: "drop", category: "drop_off" as const, rawAddress: "Returveien 2" },
  { gsmTaskId: "pick-1", category: "pick_up" as const, rawAddress: "Elkjøp Lørenskog, Solheimveien 7" },
];

function plan(attachments: ReceiptAttachment[], taskList = tasks, stops = pickupStops) {
  return Object.fromEntries(
    planReceiptUploads({ tasks: taskList, attachments, pickupStops: stops }).map((u) => [
      u.gsmTaskId,
      u.receipts.map((r) => r.id),
    ]),
  );
}

describe("planReceiptUploads", () => {
  it("puts each pickup document on its own stop's pick-up task, and all of them on drop-off and assignment", () => {
    expect(plan([pickupDocument("d1", 0), pickupDocument("d2", 1)])).toEqual({
      "pick-1": ["d1"],
      "pick-2": ["d2"],
      drop: ["d1", "d2"],
      assign: ["d1", "d2"],
    });
  });

  it("keeps dashboard receipts off every pick-up task", () => {
    expect(plan([receipt, pickupDocument("d1", 0)])).toEqual({
      "pick-1": ["d1"],
      drop: ["r1", "d1"],
      assign: ["r1", "d1"],
    });
  });

  it("matches addresses ignoring case and surrounding spaces", () => {
    const shouty = [{ gsmTaskId: "pick-1", category: "pick_up" as const, rawAddress: "  ELKJØP LØRENSKOG, SOLHEIMVEIEN 7 " }];
    expect(plan([pickupDocument("d1", 0)], shouty)).toEqual({ "pick-1": ["d1"] });
  });

  it("puts a document whose stop has no pick-up task on every pick-up task instead of losing it", () => {
    // Stop 3 was removed from the order after the customer uploaded for it.
    expect(plan([pickupDocument("d9", 2)])).toEqual({
      "pick-1": ["d9"],
      "pick-2": ["d9"],
      drop: ["d9"],
      assign: ["d9"],
    });
  });

  it("falls back the same way when GSM's address doesn't match the one sent", () => {
    const renamed = [{ gsmTaskId: "pick-x", category: "pick_up" as const, rawAddress: "Somewhere else" }];
    expect(plan([pickupDocument("d1", 0)], renamed)).toEqual({ "pick-x": ["d1"] });
  });

  it("puts a pickup document without a stop number on every pick-up task", () => {
    const unnamed = { ...pickupDocument("d1", 0), filename: "kvittering.pdf" };
    expect(plan([unnamed])).toEqual({ "pick-1": ["d1"], "pick-2": ["d1"], drop: ["d1"], assign: ["d1"] });
  });

  it("sends only the file fields, and skips tasks with nothing to upload", () => {
    const uploads = planReceiptUploads({ tasks, attachments: [receipt], pickupStops });
    expect(uploads).toEqual([
      { gsmTaskId: "assign", receipts: [file(receipt)] },
      { gsmTaskId: "drop", receipts: [file(receipt)] },
    ]);
  });
});
