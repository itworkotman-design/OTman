import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  resolveOrderNotificationMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/orders/orderNotifications", () => ({
  resolveOrderNotification: mocks.resolveOrderNotificationMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { PATCH } from "./route";

describe("PATCH /api/orders/[orderId]/notifications/[notificationId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionMock.mockImplementation(async (callback: (tx: object) => Promise<boolean>) =>
      callback({}),
    );
  });

  it("marks a notification as fixed for admins", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
    });
    mocks.resolveOrderNotificationMock.mockResolvedValue(true);

    const response = await PATCH(
      new Request(
        "http://localhost/api/orders/order-1/notifications/notification-1",
        {
          method: "PATCH",
        },
      ),
      {
        params: Promise.resolve({
          orderId: "order-1",
          notificationId: "notification-1",
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.resolveOrderNotificationMock).toHaveBeenCalledWith(
      {},
      {
        notificationId: "notification-1",
        orderId: "order-1",
        companyId: "company-1",
        resolvedByMembershipId: "membership-1",
      },
    );
  });

  it("returns 404 when the notification does not exist", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "OWNER",
    });
    mocks.resolveOrderNotificationMock.mockResolvedValue(false);

    const response = await PATCH(
      new Request(
        "http://localhost/api/orders/order-1/notifications/notification-1",
        {
          method: "PATCH",
        },
      ),
      {
        params: Promise.resolve({
          orderId: "order-1",
          notificationId: "notification-1",
        }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
  });
});
