import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  isS3AttachmentStorageConfiguredMock: vi.fn(),
  isS3StoragePathMock: vi.fn(),
  uploadAttachmentToS3Mock: vi.fn(),
  getSignedAttachmentUrlMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/orders/orderAttachmentStorage", () => ({
  getSignedAttachmentUrl: mocks.getSignedAttachmentUrlMock,
  isS3AttachmentStorageConfigured: mocks.isS3AttachmentStorageConfiguredMock,
  isS3StoragePath: mocks.isS3StoragePathMock,
  uploadAttachmentToS3: mocks.uploadAttachmentToS3Mock,
}));

import { GET, POST } from "./route";

describe("routes in /api/auth/users/logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isS3AttachmentStorageConfiguredMock.mockReturnValue(true);
    mocks.isS3StoragePathMock.mockImplementation((value: string) =>
      value.startsWith("s3://"),
    );
  });

  it("POST uploads user logos to S3", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
    });
    mocks.uploadAttachmentToS3Mock.mockResolvedValue({
      key: "orders/user-logos/user-1/logo.webp",
      storagePath: "s3://orders/user-logos/user-1/logo.webp",
    });

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3, 4])], "logo.webp", {
        type: "image/webp",
      }),
    );

    const res = await POST(
      new Request("http://localhost/api/auth/users/logo", {
        method: "POST",
        body: formData,
      }),
    );

    expect(res.status).toBe(201);
    expect(mocks.uploadAttachmentToS3Mock).toHaveBeenCalledWith({
      file: expect.any(File),
      scope: "user-logos/user-1",
    });
    await expect(res.json()).resolves.toEqual({
      ok: true,
      logoPath: "s3://orders/user-logos/user-1/logo.webp",
    });
  });

  it("POST fails when S3 storage is not configured", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
    });
    mocks.isS3AttachmentStorageConfiguredMock.mockReturnValue(false);

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1])], "logo.png", {
        type: "image/png",
      }),
    );

    const res = await POST(
      new Request("http://localhost/api/auth/users/logo", {
        method: "POST",
        body: formData,
      }),
    );

    expect(res.status).toBe(500);
    expect(mocks.uploadAttachmentToS3Mock).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "S3_ATTACHMENT_STORAGE_NOT_CONFIGURED",
    });
  });

  it("GET redirects S3 logo paths to a signed URL", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
    });
    mocks.getSignedAttachmentUrlMock.mockResolvedValue(
      "https://s3.example.test/signed-logo.webp",
    );

    const res = await GET(
      new Request(
        "http://localhost/api/auth/users/logo?path=s3%3A%2F%2Forders%2Fuser-logos%2Fuser-1%2Flogo.webp",
      ),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://s3.example.test/signed-logo.webp",
    );
    expect(mocks.getSignedAttachmentUrlMock).toHaveBeenCalledWith({
      storagePath: "s3://orders/user-logos/user-1/logo.webp",
      filename: "logo.webp",
      mimeType: null,
      download: false,
    });
  });
});
