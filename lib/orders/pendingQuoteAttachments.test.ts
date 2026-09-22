import { describe, expect, it, vi } from "vitest";
import { isValidQuoteToken, linkPendingQuoteAttachments, sniffImageMimeType } from "./pendingQuoteAttachments";

describe("isValidQuoteToken", () => {
  it("accepts a standard UUID (what crypto.randomUUID() produces client-side)", () => {
    expect(isValidQuoteToken("3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe(true);
  });

  it("rejects anything else, including strings that could end up in an S3 key or DB query unsanitized", () => {
    expect(isValidQuoteToken(null)).toBe(false);
    expect(isValidQuoteToken(undefined)).toBe(false);
    expect(isValidQuoteToken("")).toBe(false);
    expect(isValidQuoteToken("../../etc/passwd")).toBe(false);
    expect(isValidQuoteToken("' OR 1=1--")).toBe(false);
    expect(isValidQuoteToken("not-a-uuid")).toBe(false);
  });
});

function bytesFrom(hexBytes: number[]) {
  return new Uint8Array(hexBytes);
}

describe("sniffImageMimeType", () => {
  it("recognizes a real JPEG by its magic bytes", () => {
    expect(sniffImageMimeType(bytesFrom([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe("image/jpeg");
  });

  it("recognizes a real PNG by its magic bytes", () => {
    expect(sniffImageMimeType(bytesFrom([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]))).toBe(
      "image/png",
    );
  });

  it("recognizes a real WEBP by its magic bytes (RIFF....WEBP)", () => {
    const bytes = bytesFrom([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // (file size, irrelevant here)
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    expect(sniffImageMimeType(bytes)).toBe("image/webp");
  });

  it("rejects a file whose bytes don't match any known image signature — even if it claims to be one", () => {
    // e.g. a renamed .exe or .html file with a spoofed Content-Type/filename.
    expect(sniffImageMimeType(bytesFrom([0x4d, 0x5a, 0x90, 0x00]))).toBeNull(); // MZ = Windows executable
    expect(sniffImageMimeType(bytesFrom([0x3c, 0x68, 0x74, 0x6d, 0x6c]))).toBeNull(); // "<html"
  });

  it("rejects a too-short/empty buffer instead of throwing", () => {
    expect(sniffImageMimeType(bytesFrom([]))).toBeNull();
    expect(sniffImageMimeType(bytesFrom([0xff]))).toBeNull();
  });
});

describe("linkPendingQuoteAttachments", () => {
  it("copies every pending row matching the token into a real OrderAttachment, then deletes the pending rows", async () => {
    const pending = [
      { id: "pa1", quoteToken: "tok", filename: "a.jpg", mimeType: "image/jpeg", sizeBytes: 100, storagePath: "s3://x/a.jpg" },
      { id: "pa2", quoteToken: "tok", filename: "b.jpg", mimeType: "image/jpeg", sizeBytes: 200, storagePath: "s3://x/b.jpg" },
    ];
    const findMany = vi.fn().mockResolvedValue(pending);
    const create = vi.fn().mockResolvedValue({});
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const client = {
      pendingQuoteAttachment: { findMany, deleteMany },
      orderAttachment: { create },
    };

    const count = await linkPendingQuoteAttachments(client as never, { orderId: "order1", quoteToken: "tok" });

    expect(findMany).toHaveBeenCalledWith({ where: { quoteToken: "tok" } });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith({
      data: {
        orderId: "order1",
        filename: "a.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        storagePath: "s3://x/a.jpg",
        category: "ATTACHMENT",
      },
    });
    expect(deleteMany).toHaveBeenCalledWith({ where: { quoteToken: "tok" } });
    expect(count).toBe(2);
  });

  it("does nothing (no create/delete calls) when there are no pending rows for the token", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const create = vi.fn();
    const deleteMany = vi.fn();
    const client = {
      pendingQuoteAttachment: { findMany, deleteMany },
      orderAttachment: { create },
    };

    const count = await linkPendingQuoteAttachments(client as never, { orderId: "order1", quoteToken: "tok" });

    expect(create).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });
});
