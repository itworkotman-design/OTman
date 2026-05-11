import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderAttachmentFindFirstMock: vi.fn(),
  orderAttachmentCreateMock: vi.fn(),
  orderAttachmentUpdateMock: vi.fn(),
  getGsmTokenMock: vi.fn(),
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
  unlinkMock: vi.fn(),
  randomUUIDMock: vi.fn(),
  isS3AttachmentStorageConfiguredMock: vi.fn(),
  isS3StoragePathMock: vi.fn(),
  uploadAttachmentBufferToS3Mock: vi.fn(),
  deleteAttachmentFromS3Mock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    orderAttachment: {
      findFirst: mocks.orderAttachmentFindFirstMock,
      create: mocks.orderAttachmentCreateMock,
      update: mocks.orderAttachmentUpdateMock,
    },
  },
}));

vi.mock("@/lib/integrations/gsm/client", () => ({
  getGsmToken: mocks.getGsmTokenMock,
}));

vi.mock("fs/promises", () => ({
  mkdir: mocks.mkdirMock,
  writeFile: mocks.writeFileMock,
  unlink: mocks.unlinkMock,
}));

vi.mock("crypto", () => ({
  randomUUID: mocks.randomUUIDMock,
}));

vi.mock("@/lib/orders/orderAttachmentStorage", () => ({
  isS3AttachmentStorageConfigured: mocks.isS3AttachmentStorageConfiguredMock,
  isS3StoragePath: mocks.isS3StoragePathMock,
  uploadAttachmentBufferToS3: mocks.uploadAttachmentBufferToS3Mock,
  deleteAttachmentFromS3: mocks.deleteAttachmentFromS3Mock,
}));

import { syncPodPdfWithRetry } from "@/lib/integrations/gsm/downloadPodPdf";

describe("syncPodPdfWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.randomUUIDMock.mockReturnValue("uuid-1");
    mocks.getGsmTokenMock.mockResolvedValue("gsm-token");
    mocks.orderAttachmentFindFirstMock.mockResolvedValue(null);
    mocks.orderAttachmentCreateMock.mockResolvedValue({ id: "attachment-1" });
    mocks.orderAttachmentUpdateMock.mockResolvedValue({ id: "attachment-1" });
    mocks.mkdirMock.mockResolvedValue(undefined);
    mocks.writeFileMock.mockResolvedValue(undefined);
    mocks.unlinkMock.mockResolvedValue(undefined);
    mocks.isS3AttachmentStorageConfiguredMock.mockReturnValue(true);
    mocks.isS3StoragePathMock.mockReturnValue(false);
    mocks.uploadAttachmentBufferToS3Mock.mockResolvedValue({
      key: "orders/order-1/pod-task-1-uuid-1.pdf",
      storagePath: "s3://orders/order-1/pod-task-1-uuid-1.pdf",
    });
    mocks.deleteAttachmentFromS3Mock.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new Uint8Array(21_000).buffer,
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stores GSM POD PDFs in S3 when attachment storage is configured", async () => {
    const syncPromise = syncPodPdfWithRetry("order-1", "task-1");

    await vi.advanceTimersByTimeAsync(8000);
    await syncPromise;

    expect(mocks.uploadAttachmentBufferToS3Mock).toHaveBeenCalledWith({
      bytes: expect.any(Buffer),
      scope: "order-1",
      filename: "pod-task-1-uuid-1.pdf",
      contentType: "application/pdf",
    });
    expect(mocks.mkdirMock).not.toHaveBeenCalled();
    expect(mocks.writeFileMock).not.toHaveBeenCalled();
    expect(mocks.orderAttachmentCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        filename: "pod-task-1-uuid-1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 21000,
        storagePath: "s3://orders/order-1/pod-task-1-uuid-1.pdf",
        source: "GSM",
        gsmTaskId: "task-1",
        gsmDocumentId: "pod:task-1",
      }),
    });
  });

  it("deletes the previous S3 object when replacing an existing GSM POD", async () => {
    mocks.orderAttachmentFindFirstMock.mockResolvedValueOnce({
      id: "attachment-1",
      storagePath: "s3://orders/order-1/old-pod.pdf",
    });
    mocks.isS3StoragePathMock.mockReturnValue(true);

    const syncPromise = syncPodPdfWithRetry("order-1", "task-1");

    await vi.advanceTimersByTimeAsync(8000);
    await syncPromise;

    expect(mocks.orderAttachmentUpdateMock).toHaveBeenCalledWith({
      where: { id: "attachment-1" },
      data: expect.objectContaining({
        storagePath: "s3://orders/order-1/pod-task-1-uuid-1.pdf",
        source: "GSM",
      }),
    });
    expect(mocks.deleteAttachmentFromS3Mock).toHaveBeenCalledWith(
      "s3://orders/order-1/old-pod.pdf",
    );
  });
});
