import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canEditOrdersMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  attachmentFindManyMock: vi.fn(),
  attachmentCountMock: vi.fn(),
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
    order: {
      findFirst: mocks.orderFindFirstMock,
    },
    orderAttachment: {
      findMany: mocks.attachmentFindManyMock,
      count: mocks.attachmentCountMock,
      create: vi.fn(),
    },
  },
}));

import { GET, POST } from "./route";

describe("routes in /api/orders/[orderId]/attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEditOrdersMock.mockReturnValue(true);
  });

  it("GET returns 404 when the order does not exist", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.orderFindFirstMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/orders/order-1/attachments"), {
      params: Promise.resolve({ orderId: "order-1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "ORDER_NOT_FOUND",
    });
  });

  it("POST returns 400 when the file is missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      role: "ADMIN",
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.orderFindFirstMock.mockResolvedValue({ id: "order-1" });
    mocks.attachmentCountMock.mockResolvedValue(0);

    const req = new Request("http://localhost/api/orders/order-1/attachments", {
      method: "POST",
      body: new FormData(),
    });

    const res = await POST(req, {
      params: Promise.resolve({ orderId: "order-1" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FILE_REQUIRED",
    });
  });
});
