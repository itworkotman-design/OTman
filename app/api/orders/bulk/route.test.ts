import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
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
});
