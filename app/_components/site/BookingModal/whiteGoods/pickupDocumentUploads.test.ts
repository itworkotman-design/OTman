import { describe, expect, it } from "vitest";
import { collectPickupDocuments, hasEveryStorePickupDocument, planPickupDocumentUploads } from "./pickupDocumentUploads";

const fileA = new File(["a"], "a.pdf");
const fileB = new File(["b"], "b.pdf");

describe("collectPickupDocuments", () => {
  it("takes the document of every store stop, numbered by stop position", () => {
    expect(
      collectPickupDocuments([
        { source: "store", document: fileA },
        { source: "private", document: fileB },
        { source: "store", document: null },
        { source: "store", document: fileB },
      ]),
    ).toEqual([
      { stopIndex: 0, file: fileA },
      { stopIndex: 3, file: fileB },
    ]);
  });

  it("drops a document left over on a stop that's no longer a store", () => {
    expect(collectPickupDocuments([{ source: "business", document: fileA }])).toEqual([]);
  });
});

describe("planPickupDocumentUploads", () => {
  it("uploads everything on the first submit", () => {
    const wanted = [{ stopIndex: 0, file: fileA }];
    expect(planPickupDocumentUploads(wanted, [])).toEqual({ freshToken: false, toUpload: wanted });
  });

  it("on a retry, only uploads what wasn't sent yet", () => {
    const wanted = [
      { stopIndex: 0, file: fileA },
      { stopIndex: 1, file: fileB },
    ];
    expect(planPickupDocumentUploads(wanted, [{ stopIndex: 0, file: fileA }])).toEqual({
      freshToken: false,
      toUpload: [{ stopIndex: 1, file: fileB }],
    });
  });

  it("starts over under a new token when an already-sent document was removed or replaced", () => {
    const wanted = [{ stopIndex: 0, file: fileB }];
    expect(planPickupDocumentUploads(wanted, [{ stopIndex: 0, file: fileA }])).toEqual({
      freshToken: true,
      toUpload: wanted,
    });
    expect(planPickupDocumentUploads([], [{ stopIndex: 0, file: fileA }])).toEqual({ freshToken: true, toUpload: [] });
  });

  it("starts over when a sent document now belongs to another stop (its stored name says which)", () => {
    const wanted = [{ stopIndex: 1, file: fileA }];
    expect(planPickupDocumentUploads(wanted, [{ stopIndex: 0, file: fileA }]).freshToken).toBe(true);
  });
});

describe("hasEveryStorePickupDocument", () => {
  it("needs a document on every store stop, and nothing on the others", () => {
    expect(hasEveryStorePickupDocument([{ source: "store", document: fileA }, { source: "private", document: null }])).toBe(true);
    expect(hasEveryStorePickupDocument([{ source: "store", document: fileA }, { source: "store", document: null }])).toBe(false);
    expect(hasEveryStorePickupDocument([{ source: "business", document: null }])).toBe(true);
  });
});
