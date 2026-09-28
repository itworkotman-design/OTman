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

const VALID_TOKEN = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

// A minimal real (not fake-signature) JPEG: FF D8 FF ... — enough bytes for
// sniffImageMimeType to recognize it.
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const NOT_AN_IMAGE_BYTES = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // "MZ" executable header

function multipartRequest(fields: Record<string, string | Blob>, headers: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  return new Request("http://localhost/api/site/special-goods-quote/upload", {
    method: "POST",
    body: form,
    headers,
  });
}

describe("POST /api/site/special-goods-quote/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimitMock.mockResolvedValue({ allowed: true });
    mocks.incrementRateLimitMock.mockResolvedValue(undefined);
    mocks.pendingQuoteAttachmentCount.mockResolvedValue(0);
    mocks.uploadTempAttachmentBufferToS3Mock.mockResolvedValue({ storagePath: "s3://bucket/key.jpg", key: "key.jpg" });
    mocks.pendingQuoteAttachmentCreate.mockResolvedValue({ id: "pa1" });
  });

  it("rejects an invalid quoteToken", async () => {
    const file = new File([JPEG_BYTES], "photo.jpg", { type: "image/jpeg" });
    const res = await POST(multipartRequest({ file, quoteToken: "not-a-token" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "INVALID_TOKEN" });
    expect(mocks.uploadTempAttachmentBufferToS3Mock).not.toHaveBeenCalled();
  });

  it("rejects when no file is present", async () => {
    const res = await POST(multipartRequest({ quoteToken: VALID_TOKEN }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "FILE_REQUIRED" });
  });

  it("rejects a request whose Content-Length already exceeds the size cap, before reading the body", async () => {
    const file = new File([JPEG_BYTES], "photo.jpg", { type: "image/jpeg" });
    const res = await POST(
      multipartRequest({ file, quoteToken: VALID_TOKEN }, { "content-length": String(50 * 1024 * 1024) }),
    );

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "FILE_TOO_LARGE" });
    expect(mocks.uploadTempAttachmentBufferToS3Mock).not.toHaveBeenCalled();
  });

  it("rejects the 6th photo for the same quoteToken (cap is 5)", async () => {
    mocks.pendingQuoteAttachmentCount.mockResolvedValue(5);
    const file = new File([JPEG_BYTES], "photo.jpg", { type: "image/jpeg" });

    const res = await POST(multipartRequest({ file, quoteToken: VALID_TOKEN }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "TOO_MANY_PHOTOS" });
    expect(mocks.uploadTempAttachmentBufferToS3Mock).not.toHaveBeenCalled();
  });

  it("rejects a file whose actual bytes aren't a real image, even if it claims image/jpeg", async () => {
    const file = new File([NOT_AN_IMAGE_BYTES], "totally-a-photo.jpg", { type: "image/jpeg" });

    const res = await POST(multipartRequest({ file, quoteToken: VALID_TOKEN }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "INVALID_FILE_TYPE" });
    expect(mocks.uploadTempAttachmentBufferToS3Mock).not.toHaveBeenCalled();
  });

  it("rejects when the per-IP rate limit has been exceeded", async () => {
    mocks.checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterMs: 60_000 });
    const file = new File([JPEG_BYTES], "photo.jpg", { type: "image/jpeg" });

    const res = await POST(multipartRequest({ file, quoteToken: VALID_TOKEN }, { "x-forwarded-for": "203.0.113.5" }));

    expect(res.status).toBe(429);
    expect(mocks.uploadTempAttachmentBufferToS3Mock).not.toHaveBeenCalled();
  });

  it("rate-limits per IP at 5 uploads per day — matching the 5-photo cap, so one IP gets at most one quote's worth of photos per day", async () => {
    const file = new File([JPEG_BYTES], "photo.jpg", { type: "image/jpeg" });

    await POST(multipartRequest({ file, quoteToken: VALID_TOKEN }, { "x-forwarded-for": "203.0.113.5" }));

    expect(mocks.checkRateLimitMock).toHaveBeenCalledWith({
      key: "special-goods-upload:203.0.113.5",
      limit: 5,
    });
    expect(mocks.incrementRateLimitMock).toHaveBeenCalledWith({
      key: "special-goods-upload:203.0.113.5",
      windowMs: 24 * 60 * 60 * 1000,
    });
  });

  it("accepts a real photo: uploads to S3 using the SNIFFED type (not the claimed one), records it, returns its id", async () => {
    // Claims png, but the bytes are really a jpeg — the stored contentType
    // must reflect the sniffed truth, not the spoofable claim.
    const file = new File([JPEG_BYTES], "photo.png", { type: "image/png" });

    const res = await POST(multipartRequest({ file, quoteToken: VALID_TOKEN }, { "x-forwarded-for": "203.0.113.5" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, id: "pa1", filename: "photo.png" });
    expect(mocks.uploadTempAttachmentBufferToS3Mock).toHaveBeenCalledWith(
      expect.objectContaining({ scope: `quote-requests/${VALID_TOKEN}`, contentType: "image/jpeg" }),
    );
    expect(mocks.pendingQuoteAttachmentCreate).toHaveBeenCalledWith({
      data: {
        quoteToken: VALID_TOKEN,
        filename: "photo.png",
        mimeType: "image/jpeg",
        sizeBytes: JPEG_BYTES.length,
        storagePath: "s3://bucket/key.jpg",
      },
    });
    expect(mocks.incrementRateLimitMock).toHaveBeenCalled();
  });
});
