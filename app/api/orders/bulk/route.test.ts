import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  orderNotificationUpdateManyMock: vi.fn(),
  buildOrderEventSnapshotMock: vi.fn(),
  createManyOrderStatusChangedEventsMock: vi.fn(),
  createOrderUpdatedEventMock: vi.fn(),
  diffOrderEventSnapshotsMock: vi.fn(),
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
      findMany: mocks.orderFindManyMock,
      updateMany: mocks.orderUpdateManyMock,
      update: mocks.orderUpdateMock,
    },
    orderNotification: {
      updateMany: mocks.orderNotificationUpdateManyMock,
    },
  },
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  buildOrderEventSnapshot: mocks.buildOrderEventSnapshotMock,
  createManyOrderStatusChangedEvents:
    mocks.createManyOrderStatusChangedEventsMock,
  createOrderUpdatedEvent: mocks.createOrderUpdatedEventMock,
  diffOrderEventSnapshots: mocks.diffOrderEventSnapshotsMock,
}));

import { PATCH } from "./route";

describe("PATCH /api/orders/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildOrderEventSnapshotMock.mockImplementation((order) => ({
      status: order.status ?? null,
      statusNotes: order.statusNotes ?? null,
    }));
    mocks.diffOrderEventSnapshotsMock.mockImplementation((previous, next) => {
      if (previous.status !== next.status) {
        return [{ field: "status" }];
      }

      return [];
    });
    mocks.createManyOrderStatusChangedEventsMock.mockResolvedValue(undefined);
    mocks.createOrderUpdatedEventMock.mockResolvedValue(undefined);
    mocks.orderNotificationUpdateManyMock.mockResolvedValue({ count: 0 });
    mocks.orderUpdateMock.mockResolvedValue({});
  });

  it("returns 400 when no valid order ids are provided", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      user: {
        username: "Admin",
        email: "admin@example.com",
      },
    });

    const res = await PATCH(
      new Request("http://localhost/api/orders/bulk", {
        method: "PATCH",
        body: JSON.stringify({ orderIds: [], status: "done" }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_ORDER_IDS",
    });
  });

  it("updates matching orders and returns the updated count", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "OWNER",
      user: {
        username: "Owner",
        email: "owner@example.com",
      },
    });
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        companyId: "company-1",
        status: "new",
        statusNotes: "",
      },
      {
        id: "order-2",
        companyId: "company-1",
        status: "new",
        statusNotes: "",
      },
    ]);
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 2 });

    const res = await PATCH(
      new Request("http://localhost/api/orders/bulk", {
        method: "PATCH",
        body: JSON.stringify({
          orderIds: ["order-1", "order-2"],
          status: "sent",
        }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      updatedCount: 2,
      skippedHeldCount: 0,
    });
    expect(mocks.orderUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: { in: ["order-1", "order-2"] },
        companyId: "company-1",
      },
      data: {
        status: "sent",
        lastEditedByMembershipId: "membership-1",
      },
    });
    expect(mocks.orderFindManyMock).toHaveBeenCalledWith({
      where: {
        id: { in: ["order-1", "order-2"] },
        companyId: "company-1",
      },
      select: expect.any(Object),
    });
    expect(mocks.createManyOrderStatusChangedEventsMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.arrayContaining([
        expect.objectContaining({
          orderId: "order-1",
          fromStatus: "new",
          toStatus: "sent",
        }),
        expect.objectContaining({
          orderId: "order-2",
          fromStatus: "new",
          toStatus: "sent",
        }),
      ]),
    );
    expect(mocks.createOrderUpdatedEventMock).not.toHaveBeenCalled();
  });

  it("clears discount only for cancelled orders changed to another status", async () => {
    mocks.buildOrderEventSnapshotMock.mockImplementation((order) => ({
      status: order.status ?? null,
      statusNotes: order.statusNotes ?? null,
      rabatt: order.rabatt ?? null,
      subcontractorMinus: order.subcontractorMinus ?? null,
    }));
    mocks.diffOrderEventSnapshotsMock.mockImplementation((previous, next) => {
      const changes: Array<{ field: string }> = [];

      if (previous.status !== next.status) {
        changes.push({ field: "status" });
      }

      if (previous.rabatt !== next.rabatt) {
        changes.push({ field: "rabatt" });
      }

      if (previous.subcontractorMinus !== next.subcontractorMinus) {
        changes.push({ field: "subcontractorMinus" });
      }

      return changes;
    });
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "OWNER",
      user: {
        username: "Owner",
        email: "owner@example.com",
      },
    });
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        companyId: "company-1",
        status: "cancelled",
        statusNotes: "",
        rabatt: "500",
        subcontractorMinus: "300",
      },
      {
        id: "order-2",
        companyId: "company-1",
        status: "new",
        statusNotes: "",
        rabatt: "200",
        subcontractorMinus: "100",
      },
    ]);
    mocks.orderUpdateManyMock
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    const res = await PATCH(
      new Request("http://localhost/api/orders/bulk", {
        method: "PATCH",
        body: JSON.stringify({
          orderIds: ["order-1", "order-2"],
          status: "active",
        }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      updatedCount: 2,
      skippedHeldCount: 0,
    });
    expect(mocks.orderUpdateManyMock).toHaveBeenNthCalledWith(1, {
      where: {
        id: { in: ["order-1", "order-2"] },
        companyId: "company-1",
      },
      data: {
        status: "active",
        lastEditedByMembershipId: "membership-1",
      },
    });
    expect(mocks.orderUpdateManyMock).toHaveBeenNthCalledWith(2, {
      where: {
        id: { in: ["order-1"] },
        companyId: "company-1",
      },
      data: {
        rabatt: null,
        subcontractorMinus: null,
      },
    });
    expect(mocks.createOrderUpdatedEventMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        orderId: "order-1",
        changes: expect.arrayContaining([
          expect.objectContaining({ field: "status" }),
          expect.objectContaining({ field: "rabatt" }),
          expect.objectContaining({ field: "subcontractorMinus" }),
        ]),
      }),
    );
    expect(mocks.createManyOrderStatusChangedEventsMock).toHaveBeenCalledWith(
      expect.any(Object),
      [
        expect.objectContaining({
          orderId: "order-2",
          fromStatus: "new",
          toStatus: "active",
        }),
      ],
    );
  });

  it("excludes GDPR-held orders from a bulk update to paid, even when selected", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "OWNER",
      user: { username: "Owner", email: "owner@example.com" },
    });
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        companyId: "company-1",
        status: "invoiced",
        statusNotes: "",
        paidAt: null,
        invoicedAt: new Date("2026-01-01T00:00:00.000Z"),
        gdprHold: true,
      },
      {
        id: "order-2",
        companyId: "company-1",
        status: "invoiced",
        statusNotes: "",
        paidAt: null,
        invoicedAt: new Date("2026-01-01T00:00:00.000Z"),
        gdprHold: false,
      },
    ]);
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 1 });

    const res = await PATCH(
      new Request("http://localhost/api/orders/bulk", {
        method: "PATCH",
        body: JSON.stringify({
          orderIds: ["order-1", "order-2"],
          status: "paid",
        }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      updatedCount: 1,
      skippedHeldCount: 1,
    });

    // The main status update must only target the non-held order.
    expect(mocks.orderUpdateManyMock).toHaveBeenNthCalledWith(1, {
      where: {
        id: { in: ["order-2"] },
        companyId: "company-1",
      },
      data: {
        status: "paid",
        lastEditedByMembershipId: "membership-1",
      },
    });
    // No event should be logged for the held, untouched order.
    expect(mocks.createManyOrderStatusChangedEventsMock).toHaveBeenCalledWith(
      expect.any(Object),
      [
        expect.objectContaining({ orderId: "order-2" }),
      ],
    );
  });

  it("stamps paidAt/invoicedAt once, only for orders that don't already have them", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "OWNER",
      user: { username: "Owner", email: "owner@example.com" },
    });
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        companyId: "company-1",
        status: "invoiced",
        statusNotes: "",
        paidAt: null,
        invoicedAt: null,
        gdprHold: false,
      },
      {
        id: "order-2",
        companyId: "company-1",
        status: "invoiced",
        statusNotes: "",
        paidAt: new Date("2025-12-01T00:00:00.000Z"),
        invoicedAt: null,
        gdprHold: false,
      },
    ]);
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 2 });

    const res = await PATCH(
      new Request("http://localhost/api/orders/bulk", {
        method: "PATCH",
        body: JSON.stringify({
          orderIds: ["order-1", "order-2"],
          status: "paid",
        }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      updatedCount: 2,
      skippedHeldCount: 0,
    });

    // order-2 already had paidAt set, so only order-1 gets stamped.
    expect(mocks.orderUpdateManyMock).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ["order-1"] }, companyId: "company-1" },
      data: { paidAt: expect.any(Date) },
    });
  });
});
