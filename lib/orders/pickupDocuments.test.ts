import { describe, expect, it } from "vitest";
import {
  MAX_PICKUP_DOCUMENT_SIZE_BYTES,
  checkPickupDocumentFile,
  isValidPickupStopIndex,
  pickupDocumentStopIndex,
  stopsMissingPickupDocument,
  storePickupStopIndexes,
  pickupDocumentFilename,
  sniffPickupDocumentMimeType,
} from "./pickupDocuments";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const PDF = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n");
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);

describe("sniffPickupDocumentMimeType", () => {
  it("recognizes JPEG, PNG and PDF from their bytes", () => {
    expect(sniffPickupDocumentMimeType(JPEG)).toBe("image/jpeg");
    expect(sniffPickupDocumentMimeType(PNG)).toBe("image/png");
    expect(sniffPickupDocumentMimeType(PDF)).toBe("application/pdf");
  });

  it("rejects anything else, including other image formats", () => {
    expect(sniffPickupDocumentMimeType(WEBP)).toBeNull();
    expect(sniffPickupDocumentMimeType(EXE)).toBeNull();
    expect(sniffPickupDocumentMimeType(new Uint8Array())).toBeNull();
  });

  it("does not take a PDF signature that isn't at the very start", () => {
    expect(sniffPickupDocumentMimeType(new TextEncoder().encode(" %PDF-1.7"))).toBeNull();
  });
});

describe("checkPickupDocumentFile", () => {
  it("accepts a pdf, jpg or png within the size cap", () => {
    expect(checkPickupDocumentFile({ name: "kvittering.pdf", type: "application/pdf", size: 1000 })).toBeNull();
    expect(checkPickupDocumentFile({ name: "receipt.JPG", type: "image/jpeg", size: 1000 })).toBeNull();
    expect(checkPickupDocumentFile({ name: "receipt.jpeg", type: "", size: 1000 })).toBeNull();
    expect(checkPickupDocumentFile({ name: "screenshot", type: "image/png", size: 1000 })).toBeNull();
  });

  it("rejects other file types", () => {
    expect(checkPickupDocumentFile({ name: "receipt.heic", type: "image/heic", size: 1000 })).toBe("INVALID_TYPE");
    expect(checkPickupDocumentFile({ name: "receipt.docx", type: "", size: 1000 })).toBe("INVALID_TYPE");
  });

  it("rejects an empty or too large file", () => {
    expect(checkPickupDocumentFile({ name: "a.pdf", type: "application/pdf", size: 0 })).toBe("EMPTY");
    expect(
      checkPickupDocumentFile({ name: "a.pdf", type: "application/pdf", size: MAX_PICKUP_DOCUMENT_SIZE_BYTES + 1 }),
    ).toBe("TOO_LARGE");
    expect(
      checkPickupDocumentFile({ name: "a.pdf", type: "application/pdf", size: MAX_PICKUP_DOCUMENT_SIZE_BYTES }),
    ).toBeNull();
  });
});

describe("isValidPickupStopIndex", () => {
  it("only accepts small non-negative integers", () => {
    expect(isValidPickupStopIndex(0)).toBe(true);
    expect(isValidPickupStopIndex(19)).toBe(true);
    expect(isValidPickupStopIndex(20)).toBe(false);
    expect(isValidPickupStopIndex(-1)).toBe(false);
    expect(isValidPickupStopIndex(1.5)).toBe(false);
    expect(isValidPickupStopIndex(Number.NaN)).toBe(false);
  });
});

describe("pickupDocumentFilename", () => {
  it("prefixes the stop number so staff know which store it belongs to", () => {
    expect(pickupDocumentFilename(0, "kvittering.pdf")).toBe("Pickup 1 - kvittering.pdf");
    expect(pickupDocumentFilename(2, "  ordre.png ")).toBe("Pickup 3 - ordre.png");
  });

  it("falls back to a generic name and caps the length", () => {
    expect(pickupDocumentFilename(0, "   ")).toBe("Pickup 1 - document");
    expect(pickupDocumentFilename(0, `${"a".repeat(300)}.pdf`).length).toBeLessThanOrEqual(160);
    expect(pickupDocumentFilename(0, `${"a".repeat(300)}.pdf`).endsWith(".pdf")).toBe(true);
  });
});

describe("storePickupStopIndexes", () => {
  it("lists every store stop by position (0 = first pickup)", () => {
    expect(storePickupStopIndexes(["store", "private", null, "store"])).toEqual([0, 3]);
    expect(storePickupStopIndexes(["business"])).toEqual([]);
  });
});

describe("stopsMissingPickupDocument", () => {
  it("returns the store stops with no uploaded document, read from the stored names", () => {
    const filenames = [pickupDocumentFilename(0, "a.pdf"), pickupDocumentFilename(2, "Pickup 2 - tricky.pdf")];
    expect(stopsMissingPickupDocument([0, 1, 2], filenames)).toEqual([1]);
    expect(stopsMissingPickupDocument([0], [])).toEqual([0]);
    expect(stopsMissingPickupDocument([], [])).toEqual([]);
  });

  it("does not mistake stop 1 for stop 10", () => {
    expect(stopsMissingPickupDocument([0], [pickupDocumentFilename(9, "a.pdf")])).toEqual([0]);
  });
});

describe("pickupDocumentStopIndex", () => {
  it("reads the stop back from the stored name", () => {
    expect(pickupDocumentStopIndex(pickupDocumentFilename(0, "a.pdf"))).toBe(0);
    expect(pickupDocumentStopIndex(pickupDocumentFilename(11, "Pickup 3 - b.pdf"))).toBe(11);
    expect(pickupDocumentStopIndex("kvittering.pdf")).toBeNull();
    expect(pickupDocumentStopIndex("Pickup 0 - a.pdf")).toBeNull();
  });
});
