import { describe, expect, it, vi } from "vitest";
import {
  cleanupExpiredPendingQuoteAttachments,
  isValidQuoteToken,
  linkPendingQuoteAttachments,
  promotePendingQuoteAttachments,
  sniffImageMimeType,
} from "./pendingQuoteAttachments";

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

  it("recognizes iPhone HEIC photos by their ISO-BMFF ftyp brand", () => {
    for (const brand of ["heic", "heix", "hevc", "hevx", "heim", "heis"]) {
      const bytes = bytesFrom([
        0x00, 0x00, 0x00, 0x18, // box size
        0x66, 0x74, 0x79, 0x70, // ftyp
        ...Array.from(brand, (c) => c.charCodeAt(0)),
      ]);
      expect(sniffImageMimeType(bytes)).toBe("image/heic");
    }
  });

  it("recognizes HEIF photos (mif1/msf1 brands) from Android and other phones", () => {
    for (const brand of ["mif1", "msf1"]) {
      const bytes = bytesFrom([
        0x00, 0x00, 0x00, 0x18,
        0x66, 0x74, 0x79, 0x70,
        ...Array.from(brand, (c) => c.charCodeAt(0)),
      ]);
      expect(sniffImageMimeType(bytes)).toBe("image/heif");
    }
  });

  it("rejects other ISO-BMFF files (e.g. an MP4 video, brand isom) even though they share the ftyp box", () => {
    const bytes = bytesFrom([
      0x00, 0x00, 0x00, 0x18,
      0x66, 0x74, 0x79, 0x70,
      0x69, 0x73, 0x6f, 0x6d, // isom
    ]);
    expect(sniffImageMimeType(bytes)).toBeNull();
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

describe("promotePendingQuoteAttachments", () => {
  function makeClient(rows: { id: string; storagePath: string }[]) {
    return {
      pendingQuoteAttachment: {
        findMany: vi.fn().mockResolvedValue(rows),
        update: vi.fn().mockResolvedValue({}),
      },
    };
  }

  it("moves every tmp/ row to its final path and records the new path on the row", async () => {
    const client = makeClient([
      { id: "a", storagePath: "s3://tmp/quote-requests/tok/a.jpg" },
      { id: "b", storagePath: "s3://tmp/quote-requests/tok/b.jpg" },
    ]);
    const promote = vi.fn(async (p: string) => p.replace("s3://tmp/", "s3://orders/"));

    const count = await promotePendingQuoteAttachments(client as never, { quoteToken: "tok", promote });

    expect(count).toBe(2);
    expect(promote).toHaveBeenCalledTimes(2);
    expect(client.pendingQuoteAttachment.update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { storagePath: "s3://orders/quote-requests/tok/a.jpg" },
    });
    expect(client.pendingQuoteAttachment.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { storagePath: "s3://orders/quote-requests/tok/b.jpg" },
    });
  });

  it("skips rows already promoted by an earlier, partially-failed attempt (retry-safe)", async () => {
    const client = makeClient([
      { id: "a", storagePath: "s3://orders/quote-requests/tok/a.jpg" },
      { id: "b", storagePath: "s3://tmp/quote-requests/tok/b.jpg" },
    ]);
    const promote = vi.fn(async (p: string) => p.replace("s3://tmp/", "s3://orders/"));

    await promotePendingQuoteAttachments(client as never, { quoteToken: "tok", promote });

    expect(promote).toHaveBeenCalledTimes(1);
    expect(promote).toHaveBeenCalledWith("s3://tmp/quote-requests/tok/b.jpg");
  });

  it("propagates a failed move so the caller can abort before creating the order", async () => {
    const client = makeClient([{ id: "a", storagePath: "s3://tmp/quote-requests/tok/a.jpg" }]);
    const promote = vi.fn().mockRejectedValue(new Error("copy failed"));

    await expect(promotePendingQuoteAttachments(client as never, { quoteToken: "tok", promote })).rejects.toThrow(
      "copy failed",
    );
    expect(client.pendingQuoteAttachment.update).not.toHaveBeenCalled();
  });
});

describe("cleanupExpiredPendingQuoteAttachments", () => {
  const now = new Date("2026-09-28T12:00:00Z");

  function makeClient(rows: { id: string; storagePath: string }[], referencedPaths: string[] = []) {
    return {
      pendingQuoteAttachment: {
        findMany: vi.fn().mockResolvedValue(rows),
        deleteMany: vi.fn().mockResolvedValue({ count: rows.length }),
      },
      orderAttachment: {
        findFirst: vi.fn(async ({ where }: { where: { storagePath: string } }) =>
          referencedPaths.includes(where.storagePath) ? { id: "oa" } : null,
        ),
      },
    };
  }

  it("selects only rows older than the cutoff, deletes their files and then the rows", async () => {
    const client = makeClient([{ id: "a", storagePath: "s3://tmp/quote-requests/tok/a.jpg" }]);
    const deleteFile = vi.fn().mockResolvedValue(undefined);

    const result = await cleanupExpiredPendingQuoteAttachments(client as never, { now, maxAgeMs: 24 * 3600_000, deleteFile });

    expect(client.pendingQuoteAttachment.findMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date("2026-09-27T12:00:00Z") } },
      take: expect.any(Number),
    });
    expect(deleteFile).toHaveBeenCalledWith("s3://tmp/quote-requests/tok/a.jpg");
    expect(client.pendingQuoteAttachment.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["a"] } } });
    expect(result).toEqual({ scanned: 1, filesDeleted: 1, rowsDeleted: 1 });
  });

  it("never deletes the file of a row whose path an OrderAttachment already references (crash between link steps)", async () => {
    const client = makeClient([{ id: "a", storagePath: "s3://orders/quote-requests/tok/a.jpg" }], [
      "s3://orders/quote-requests/tok/a.jpg",
    ]);
    const deleteFile = vi.fn();

    const result = await cleanupExpiredPendingQuoteAttachments(client as never, { now, maxAgeMs: 24 * 3600_000, deleteFile });

    expect(deleteFile).not.toHaveBeenCalled();
    expect(client.pendingQuoteAttachment.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["a"] } } });
    expect(result).toEqual({ scanned: 1, filesDeleted: 0, rowsDeleted: 1 });
  });

  it("does nothing when there are no expired rows", async () => {
    const client = makeClient([]);
    const deleteFile = vi.fn();

    const result = await cleanupExpiredPendingQuoteAttachments(client as never, { now, maxAgeMs: 24 * 3600_000, deleteFile });

    expect(client.pendingQuoteAttachment.deleteMany).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, filesDeleted: 0, rowsDeleted: 0 });
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
