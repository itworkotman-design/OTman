import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  isS3AttachmentStorageConfiguredMock: vi.fn(),
  uploadAttachmentToS3Mock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/orders/orderAttachmentStorage", () => ({
  isS3AttachmentStorageConfigured: mocks.isS3AttachmentStorageConfiguredMock,
  uploadAttachmentToS3: mocks.uploadAttachmentToS3Mock,
}));

import { POST } from "./route";

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isS3AttachmentStorageConfiguredMock.mockReturnValue(true);
  });

  it("requires an authenticated user", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await POST(new Request("http://localhost/api/upload"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("uploads supported files to S3", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
    });
    mocks.uploadAttachmentToS3Mock.mockResolvedValue({
      key: "orders/direct/user-1/manual.pdf",
      storagePath: "s3://orders/direct/user-1/manual.pdf",
    });

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3, 4])], "manual.pdf", {
        type: "application/pdf",
      }),
    );

    const res = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: formData,
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.uploadAttachmentToS3Mock).toHaveBeenCalledWith({
      file: expect.any(File),
      scope: "direct/user-1",
    });
    await expect(res.json()).resolves.toEqual({
      ok: true,
      key: "orders/direct/user-1/manual.pdf",
      storagePath: "s3://orders/direct/user-1/manual.pdf",
    });
  });
});
