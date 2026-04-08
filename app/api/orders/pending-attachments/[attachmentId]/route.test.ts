import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  findFirstMock: vi.fn(),
  deleteMock: vi.fn(),
  unlinkMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    pendingOrderAttachment: {
      findFirst: mocks.findFirstMock,
      delete: mocks.deleteMock,
    },
  },
}));

vi.mock("fs/promises", () => ({
  unlink: mocks.unlinkMock,
}));

import { DELETE } from "./route";

describe("DELETE /api/orders/pending-attachments/[attachmentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the attachment does not belong to the session", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
    });
    mocks.findFirstMock.mockResolvedValue(null);

    const res = await DELETE(
      new Request("http://localhost/api/orders/pending-attachments/att-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ attachmentId: "att-1" }) },
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "ATTACHMENT_NOT_FOUND",
    });
  });

  it("deletes the pending attachment when found", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
    });
    mocks.findFirstMock.mockResolvedValue({
      id: "att-1",
      storagePath: "/uploads/pending-orders/user-1/file.png",
    });

    const res = await DELETE(
      new Request("http://localhost/api/orders/pending-attachments/att-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ attachmentId: "att-1" }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mocks.deleteMock).toHaveBeenCalledWith({
      where: { id: "att-1" },
    });
  });
});
