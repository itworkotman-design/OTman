import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canEditOrdersMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  attachmentFindFirstMock: vi.fn(),
  attachmentDeleteMock: vi.fn(),
  unlinkMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/users/orderAccess", () => ({
  canEditOrders: mocks.canEditOrdersMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    orderAttachment: {
      findFirst: mocks.attachmentFindFirstMock,
      delete: mocks.attachmentDeleteMock,
    },
  },
}));

vi.mock("fs/promises", () => ({
  unlink: mocks.unlinkMock,
}));

import { DELETE } from "./route";

describe("DELETE /api/orders/attachments/[attachmentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEditOrdersMock.mockReturnValue(true);
  });

  it("returns 404 when the attachment cannot be found", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      role: "ADMIN",
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.attachmentFindFirstMock.mockResolvedValue(null);

    const res = await DELETE(new Request("http://localhost/api/orders/attachments/att-1"), {
      params: Promise.resolve({ attachmentId: "att-1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "ATTACHMENT_NOT_FOUND",
    });
  });

  it("deletes the attachment record and uploaded file when found", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      role: "ADMIN",
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.attachmentFindFirstMock.mockResolvedValue({
      id: "att-1",
      storagePath: "/uploads/orders/order-1/file.png",
    });
    mocks.attachmentDeleteMock.mockResolvedValue({ id: "att-1" });

    const res = await DELETE(new Request("http://localhost/api/orders/attachments/att-1"), {
      params: Promise.resolve({ attachmentId: "att-1" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mocks.attachmentDeleteMock).toHaveBeenCalledWith({
      where: { id: "att-1" },
    });
    expect(mocks.unlinkMock).toHaveBeenCalledTimes(1);
  });
});
