import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  attachmentFindFirstMock: vi.fn(),
  readFileMock: vi.fn(),
  statMock: vi.fn(),
  isS3StoragePathMock: vi.fn(),
  downloadAttachmentFromS3Mock: vi.fn(),
  getSignedAttachmentUrlMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    pendingOrderAttachment: {
      findFirst: mocks.attachmentFindFirstMock,
    },
  },
}));

vi.mock("fs/promises", () => ({
  readFile: mocks.readFileMock,
  stat: mocks.statMock,
}));

vi.mock("@/lib/orders/orderAttachmentStorage", () => ({
  isS3StoragePath: mocks.isS3StoragePathMock,
  downloadAttachmentFromS3: mocks.downloadAttachmentFromS3Mock,
  getSignedAttachmentUrl: mocks.getSignedAttachmentUrlMock,
}));

import { GET } from "./route";

describe("GET /api/orders/pending-attachments/[attachmentId]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isS3StoragePathMock.mockReturnValue(false);
    mocks.getSignedAttachmentUrlMock.mockResolvedValue(null);
  });

  it("returns 401 when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await GET(
      new Request("http://localhost/api/orders/pending-attachments/att-1/download"),
      { params: Promise.resolve({ attachmentId: "att-1" }) },
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("returns S3-backed pending attachments", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "user-1" });
    mocks.isS3StoragePathMock.mockReturnValue(true);
    mocks.getSignedAttachmentUrlMock.mockResolvedValue(
      "https://signed.example.test/pending.pdf",
    );
    mocks.attachmentFindFirstMock.mockResolvedValue({
      filename: "pending.pdf",
      mimeType: "application/pdf",
      sizeBytes: 3,
      storagePath: "s3://orders/pending-orders/user-1/pending.pdf",
    });

    const res = await GET(
      new Request("http://localhost/api/orders/pending-attachments/att-1/download"),
      { params: Promise.resolve({ attachmentId: "att-1" }) },
    );

    expect(res.status).toBe(307);
    expect(mocks.getSignedAttachmentUrlMock).toHaveBeenCalledWith({
      storagePath: "s3://orders/pending-orders/user-1/pending.pdf",
      filename: "pending.pdf",
      mimeType: "application/pdf",
      download: false,
    });
    expect(res.headers.get("Location")).toBe(
      "https://signed.example.test/pending.pdf",
    );
  });
});
