import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getSignedAttachmentUrl: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { orderAttachment: { findFirst: mocks.findFirst } } }));
vi.mock("@/lib/orders/orderAttachmentStorage", () => ({ getSignedAttachmentUrl: mocks.getSignedAttachmentUrl }));

import { GET } from "./route";
import { pickupDocumentLinkSignature } from "@/lib/orders/pickupDocumentLinks";

function get(attachmentId: string, sig: string | null) {
  const query = sig === null ? "" : `?s=${sig}`;
  return GET(new Request(`http://localhost/api/public/pickup-documents/${attachmentId}${query}`), {
    params: Promise.resolve({ attachmentId }),
  });
}

describe("GET /api/public/pickup-documents/[attachmentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ATTACHMENT_LINK_SECRET = "test-secret";
    mocks.findFirst.mockResolvedValue({
      id: "att-1",
      filename: "Pickup 1 - kvittering.pdf",
      mimeType: "application/pdf",
      storagePath: "s3://orders/k.pdf",
    });
    mocks.getSignedAttachmentUrl.mockResolvedValue("https://s3.example/signed");
  });

  it("redirects a correctly signed link to a fresh S3 link, opened inline", async () => {
    const res = await get("att-1", pickupDocumentLinkSignature("att-1"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://s3.example/signed");
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "att-1", source: "pickup-document" } }),
    );
    expect(mocks.getSignedAttachmentUrl).toHaveBeenCalledWith(expect.objectContaining({ download: false }));
  });

  it("is a plain 404 for a bad or missing signature, without touching the database", async () => {
    for (const sig of [null, "", pickupDocumentLinkSignature("att-2")]) {
      const res = await get("att-1", sig);
      expect(res.status).toBe(404);
    }
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("is a 404 once the attachment is gone (or isn't a pickup document)", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const res = await get("att-1", pickupDocumentLinkSignature("att-1"));
    expect(res.status).toBe(404);
  });
});
