import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  orderNotificationFindManyMock: vi.fn(),
  orderNotificationCreateMock: vi.fn(),
  orderNotificationCountMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
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
      update: mocks.orderUpdateMock,
    },
    orderNotification: {
      findMany: mocks.orderNotificationFindManyMock,
      create: mocks.orderNotificationCreateMock,
      count: mocks.orderNotificationCountMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { GET, POST } from "./route";

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
        scheduledFor: null,
        resolvedAt: null,
        resolvedByMembership: null,
      },
      {
        id: "notification-2",
        type: "CUSTOM",
        title: "Follow up with customer",
        message: "Reminder to call back.",
        createdAt: new Date("2026-04-20T08:00:00.000Z"),
        scheduledFor: new Date("2026-08-01T09:00:00.000Z"),
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
          scheduledFor: null,
          resolvedAt: null,
          resolvedBy: "",
        },
        {
          id: "notification-2",
          type: "CUSTOM",
          title: "Follow up with customer",
          message: "Reminder to call back.",
          createdAt: new Date("2026-04-20T08:00:00.000Z").toISOString(),
          scheduledFor: new Date("2026-08-01T09:00:00.000Z").toISOString(),
          resolvedAt: null,
          resolvedBy: "",
        },
      ],
    });

    expect(mocks.orderNotificationFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orderId: "order-1",
          companyId: "company-1",
        },
      }),
    );
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

describe("POST /api/orders/[orderId]/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.transactionMock.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        orderNotification: {
          create: mocks.orderNotificationCreateMock,
          count: mocks.orderNotificationCountMock,
        },
        order: {
          update: mocks.orderUpdateMock,
        },
      }),
    );

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
  });

  it("creates a custom scheduled notification for admin users", async () => {
    mocks.orderNotificationCreateMock.mockResolvedValue({
      id: "notification-2",
      type: "CUSTOM",
      title: "Call customer",
      message: "Confirm the delivery window with the customer.",
      createdAt: new Date("2026-07-03T08:00:00.000Z"),
      scheduledFor: new Date(2026, 6, 10, 9, 0, 0, 0),
      resolvedAt: null,
    });
    mocks.orderNotificationCountMock.mockResolvedValue(1);

    const response = await POST(
      new Request("http://localhost/api/orders/order-1/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: "Call customer",
          message: "Confirm the delivery window with the customer.",
          date: "2026-07-10",
          hour: 9,
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      notification: {
        id: "notification-2",
        type: "CUSTOM",
        title: "Call customer",
        message: "Confirm the delivery window with the customer.",
        createdAt: new Date("2026-07-03T08:00:00.000Z").toISOString(),
        scheduledFor: new Date(2026, 6, 10, 9, 0, 0, 0).toISOString(),
        resolvedAt: null,
        resolvedBy: "",
      },
    });

    expect(mocks.orderNotificationCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        companyId: "company-1",
        type: "CUSTOM",
        title: "Call customer",
        message: "Confirm the delivery window with the customer.",
        scheduledFor: new Date(2026, 6, 10, 9, 0, 0, 0),
      }),
    });
  });

  it("rejects an hour outside the 6-22 window", async () => {
    const response = await POST(
      new Request("http://localhost/api/orders/order-1/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: "Call customer",
          message: "Confirm the delivery window with the customer.",
          date: "2026-07-10",
          hour: 23,
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_SCHEDULE",
    });
    expect(mocks.orderNotificationCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a missing title or message", async () => {
    const response = await POST(
      new Request("http://localhost/api/orders/order-1/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: "",
          message: "",
          date: "2026-07-10",
          hour: 9,
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "TITLE_AND_MESSAGE_REQUIRED",
    });
  });

  it("returns 403 for non-admin users", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
    });

    const response = await POST(
      new Request("http://localhost/api/orders/order-1/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: "Call customer",
          message: "Confirm the delivery window with the customer.",
          date: "2026-07-10",
          hour: 9,
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
  });
});
