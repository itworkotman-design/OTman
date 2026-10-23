import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildPickupDocumentLinks, pickupDocumentLinkSignature, verifyPickupDocumentLinkSignature } from "./pickupDocumentLinks";

describe("pickup document links", () => {
  beforeEach(() => {
    process.env.ATTACHMENT_LINK_SECRET = "test-secret";
    process.env.ORDER_ACTION_BASE_URL = "https://otman.no/";
  });
  afterEach(() => {
    delete process.env.ATTACHMENT_LINK_SECRET;
    delete process.env.ORDER_ACTION_BASE_URL;
  });

  it("signs an attachment id so only that id verifies", () => {
    const sig = pickupDocumentLinkSignature("att-1")!;
    expect(sig).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(verifyPickupDocumentLinkSignature("att-1", sig)).toBe(true);
    expect(verifyPickupDocumentLinkSignature("att-2", sig)).toBe(false);
    expect(verifyPickupDocumentLinkSignature("att-1", "")).toBe(false);
    expect(verifyPickupDocumentLinkSignature("att-1", sig.slice(0, -1))).toBe(false);
  });

  it("never signs or verifies when no secret is configured", () => {
    const sig = pickupDocumentLinkSignature("att-1")!;
    delete process.env.ATTACHMENT_LINK_SECRET;
    expect(pickupDocumentLinkSignature("att-1")).toBeNull();
    expect(verifyPickupDocumentLinkSignature("att-1", sig)).toBe(false);
  });

  it("builds one stable link per pickup document, with the stop it belongs to", () => {
    const links = buildPickupDocumentLinks([
      { id: "att-1", filename: "Pickup 2 - kvittering.pdf" },
      { id: "att-2", filename: "odd-name.pdf" },
    ]);
    expect(links).toEqual([
      {
        stopIndex: 1,
        filename: "Pickup 2 - kvittering.pdf",
        url: `https://otman.no/api/public/pickup-documents/att-1?s=${pickupDocumentLinkSignature("att-1")}`,
      },
      {
        stopIndex: null,
        filename: "odd-name.pdf",
        url: `https://otman.no/api/public/pickup-documents/att-2?s=${pickupDocumentLinkSignature("att-2")}`,
      },
    ]);
  });

  it("gives no url when links can't be built (missing secret or base URL)", () => {
    delete process.env.ORDER_ACTION_BASE_URL;
    expect(buildPickupDocumentLinks([{ id: "att-1", filename: "Pickup 1 - a.pdf" }])).toEqual([
      { stopIndex: 0, filename: "Pickup 1 - a.pdf", url: null },
    ]);
  });
});
