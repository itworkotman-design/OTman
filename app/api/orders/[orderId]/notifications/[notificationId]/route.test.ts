import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  resolveOrderNotificationMock: vi.fn(),
  updateCustomOrderNotificationMock: vi.fn(),
  deleteCustomOrderNotificationMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/orders/orderNotifications", () => ({
  resolveOrderNotification: mocks.resolveOrderNotificationMock,
  updateCustomOrderNotification: mocks.updateCustomOrderNotificationMock,
  deleteCustomOrderNotification: mocks.deleteCustomOrderNotificationMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { DELETE, PATCH, PUT } from "./route";

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

describe("PUT /api/orders/[orderId]/notifications/[notificationId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionMock.mockImplementation(async (callback: (tx: object) => Promise<boolean>) =>
      callback({}),
    );
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
    });
  });

  it("updates a custom notification for admins", async () => {
    mocks.updateCustomOrderNotificationMock.mockResolvedValue(true);

    const response = await PUT(
      new Request("http://localhost/api/orders/order-1/notifications/notification-1", {
        method: "PUT",
        body: JSON.stringify({
          title: "Updated title",
          message: "Updated message",
          date: "2026-07-15",
          hour: 14,
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1", notificationId: "notification-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.updateCustomOrderNotificationMock).toHaveBeenCalledWith(
      {},
      {
        notificationId: "notification-1",
        orderId: "order-1",
        companyId: "company-1",
        title: "Updated title",
        message: "Updated message",
        scheduledFor: new Date(2026, 6, 15, 14, 0, 0, 0),
      },
    );
  });

  it("returns 404 when the notification does not exist or is not custom", async () => {
    mocks.updateCustomOrderNotificationMock.mockResolvedValue(false);

    const response = await PUT(
      new Request("http://localhost/api/orders/order-1/notifications/notification-1", {
        method: "PUT",
        body: JSON.stringify({
          title: "Updated title",
          message: "Updated message",
          date: "2026-07-15",
          hour: 14,
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1", notificationId: "notification-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("rejects an invalid schedule", async () => {
    const response = await PUT(
      new Request("http://localhost/api/orders/order-1/notifications/notification-1", {
        method: "PUT",
        body: JSON.stringify({
          title: "Updated title",
          message: "Updated message",
          date: "2026-07-15",
          hour: 3,
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1", notificationId: "notification-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "INVALID_SCHEDULE" });
    expect(mocks.updateCustomOrderNotificationMock).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin users", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
    });

    const response = await PUT(
      new Request("http://localhost/api/orders/order-1/notifications/notification-1", {
        method: "PUT",
        body: JSON.stringify({
          title: "Updated title",
          message: "Updated message",
          date: "2026-07-15",
          hour: 14,
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1", notificationId: "notification-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "FORBIDDEN" });
  });
});

describe("DELETE /api/orders/[orderId]/notifications/[notificationId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionMock.mockImplementation(async (callback: (tx: object) => Promise<boolean>) =>
      callback({}),
    );
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
    });
  });

  it("deletes a custom notification for admins", async () => {
    mocks.deleteCustomOrderNotificationMock.mockResolvedValue(true);

    const response = await DELETE(
      new Request("http://localhost/api/orders/order-1/notifications/notification-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ orderId: "order-1", notificationId: "notification-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.deleteCustomOrderNotificationMock).toHaveBeenCalledWith(
      {},
      {
        notificationId: "notification-1",
        orderId: "order-1",
        companyId: "company-1",
      },
    );
  });

  it("returns 404 when the notification does not exist or is not custom", async () => {
    mocks.deleteCustomOrderNotificationMock.mockResolvedValue(false);

    const response = await DELETE(
      new Request("http://localhost/api/orders/order-1/notifications/notification-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ orderId: "order-1", notificationId: "notification-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("returns 403 for non-admin users", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
    });

    const response = await DELETE(
      new Request("http://localhost/api/orders/order-1/notifications/notification-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ orderId: "order-1", notificationId: "notification-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "FORBIDDEN" });
  });
});
