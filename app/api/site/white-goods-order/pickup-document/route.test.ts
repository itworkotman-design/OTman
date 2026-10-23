import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pendingQuoteAttachmentCount: vi.fn(),
  pendingQuoteAttachmentCreate: vi.fn(),
  checkRateLimitMock: vi.fn(),
  incrementRateLimitMock: vi.fn(),
  uploadTempAttachmentBufferToS3Mock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    pendingQuoteAttachment: {
      count: mocks.pendingQuoteAttachmentCount,
      create: mocks.pendingQuoteAttachmentCreate,
    },
  },
}));

vi.mock("@/lib/auth/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimitMock,
  incrementRateLimit: mocks.incrementRateLimitMock,
}));

vi.mock("@/lib/orders/orderAttachmentStorage", () => ({
  uploadTempAttachmentBufferToS3: mocks.uploadTempAttachmentBufferToS3Mock,
}));

import { POST } from "./route";
import { MAX_PICKUP_DOCUMENTS_PER_ORDER } from "@/lib/orders/pickupDocuments";

const VALID_TOKEN = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const HEIC_BYTES = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);

function multipartRequest(fields: Record<string, string | Blob>, headers: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return new Request("http://localhost/api/site/white-goods-order/pickup-document", {
    method: "POST",
    body: form,
    headers,
  });
}

const pdf = () => new File([PDF_BYTES], "kvittering.pdf", { type: "application/pdf" });

describe("POST /api/site/white-goods-order/pickup-document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimitMock.mockResolvedValue({ allowed: true });
    mocks.incrementRateLimitMock.mockResolvedValue(undefined);
    mocks.pendingQuoteAttachmentCount.mockResolvedValue(0);
    mocks.uploadTempAttachmentBufferToS3Mock.mockResolvedValue({ storagePath: "s3://tmp/x.pdf", key: "tmp/x.pdf" });
    mocks.pendingQuoteAttachmentCreate.mockResolvedValue({ id: "pa1" });
  });

  it("stages a PDF under tmp/ in PendingQuoteAttachment, named after its pickup stop", async () => {
    const res = await POST(multipartRequest({ file: pdf(), uploadToken: VALID_TOKEN, stopIndex: "1" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, id: "pa1" });
    expect(mocks.uploadTempAttachmentBufferToS3Mock).toHaveBeenCalledWith(
      expect.objectContaining({ scope: `pickup-documents/${VALID_TOKEN}`, contentType: "application/pdf" }),
    );
    expect(mocks.pendingQuoteAttachmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quoteToken: VALID_TOKEN,
        filename: "Pickup 2 - kvittering.pdf",
        mimeType: "application/pdf",
        storagePath: "s3://tmp/x.pdf",
      }),
    });
    expect(mocks.incrementRateLimitMock).toHaveBeenCalledTimes(1);
  });

  it("accepts a PNG", async () => {
    const file = new File([PNG_BYTES], "ordre.png", { type: "image/png" });
    const res = await POST(multipartRequest({ file, uploadToken: VALID_TOKEN, stopIndex: "0" }));
    expect(res.status).toBe(200);
  });

  it("rejects a file whose bytes aren't PDF/JPEG/PNG, whatever its name says", async () => {
    const file = new File([HEIC_BYTES], "fake.pdf", { type: "application/pdf" });
    const res = await POST(multipartRequest({ file, uploadToken: VALID_TOKEN, stopIndex: "0" }));
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("INVALID_FILE_TYPE");
    expect(mocks.uploadTempAttachmentBufferToS3Mock).not.toHaveBeenCalled();
  });

  it("rejects an oversized request before reading the body", async () => {
    const res = await POST(
      multipartRequest({ file: pdf(), uploadToken: VALID_TOKEN, stopIndex: "0" }, { "content-length": String(50 * 1024 * 1024) }),
    );
    expect(res.status).toBe(413);
    expect((await res.json()).reason).toBe("FILE_TOO_LARGE");
  });

  it("rejects an invalid token or stop index", async () => {
    let res = await POST(multipartRequest({ file: pdf(), uploadToken: "nope", stopIndex: "0" }));
    expect((await res.json()).reason).toBe("INVALID_TOKEN");

    res = await POST(multipartRequest({ file: pdf(), uploadToken: VALID_TOKEN, stopIndex: "99" }));
    expect((await res.json()).reason).toBe("INVALID_STOP");
  });

  it("requires a file", async () => {
    const res = await POST(multipartRequest({ uploadToken: VALID_TOKEN, stopIndex: "0" }));
    expect((await res.json()).reason).toBe("FILE_REQUIRED");
  });

  it("caps the number of documents per order", async () => {
    mocks.pendingQuoteAttachmentCount.mockResolvedValue(MAX_PICKUP_DOCUMENTS_PER_ORDER);
    const res = await POST(multipartRequest({ file: pdf(), uploadToken: VALID_TOKEN, stopIndex: "0" }));
    expect((await res.json()).reason).toBe("TOO_MANY_FILES");
  });

  it("is rate limited per IP", async () => {
    mocks.checkRateLimitMock.mockResolvedValue({ allowed: false });
    const res = await POST(multipartRequest({ file: pdf(), uploadToken: VALID_TOKEN, stopIndex: "0" }, { "x-forwarded-for": "203.0.113.5" }));
    expect(res.status).toBe(429);
    expect(mocks.checkRateLimitMock).toHaveBeenCalledWith(expect.objectContaining({ key: "pickup-document-upload:203.0.113.5" }));
  });
});
