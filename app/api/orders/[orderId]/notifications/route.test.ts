import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  orderNotificationFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    order: {
      findFirst: mocks.orderFindFirstMock,
    },
    orderNotification: {
      findMany: mocks.orderNotificationFindManyMock,
    },
  },
}));

import { GET } from "./route";

describe("GET /api/orders/[orderId]/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns notifications for admin users", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
    });
    mocks.orderFindFirstMock.mockResolvedValue({
      id: "order-1",
    });
    mocks.orderNotificationFindManyMock.mockResolvedValue([
      {
        id: "notification-1",
        type: "GSM_REVIEW",
        title: "GSM requires review",
        message: "Check the returned task note.",
        createdAt: new Date("2026-04-20T08:00:00.000Z"),
        resolvedAt: null,
        resolvedByMembership: null,
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/orders/order-1/notifications"),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      notifications: [
        {
          id: "notification-1",
          type: "GSM_REVIEW",
          title: "GSM requires review",
          message: "Check the returned task note.",
          createdAt: new Date("2026-04-20T08:00:00.000Z").toISOString(),
          resolvedAt: null,
          resolvedBy: "",
        },
      ],
    });
  });

  it("returns 403 for non-admin users", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
    });

    const response = await GET(
      new Request("http://localhost/api/orders/order-1/notifications"),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
  });
});
