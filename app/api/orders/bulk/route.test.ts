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
  findCancelledOrderPartnerMock: vi.fn(),
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

vi.mock("@/lib/orders/cancelledOrderPartner", () => ({
  findCancelledOrderPartner: mocks.findCancelledOrderPartnerMock,
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
    mocks.findCancelledOrderPartnerMock.mockResolvedValue(null);
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

  it("does not touch discount fields when status changes away from cancelled", async () => {
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
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 2 });

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
    // Main update + statusChangedAt stamp; nothing touches discount fields.
    expect(mocks.orderUpdateManyMock).toHaveBeenCalledTimes(2);
    expect(mocks.orderUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: { in: ["order-1", "order-2"] },
        companyId: "company-1",
      },
      data: {
        status: "active",
        lastEditedByMembershipId: "membership-1",
      },
    });
    expect(mocks.orderUpdateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["order-1", "order-2"] }, companyId: "company-1" },
      data: { statusChangedAt: expect.any(Date) },
    });
    expect(mocks.createOrderUpdatedEventMock).not.toHaveBeenCalled();
    expect(mocks.createManyOrderStatusChangedEventsMock).toHaveBeenCalledWith(
      expect.any(Object),
      [
        expect.objectContaining({
          orderId: "order-1",
          fromStatus: "cancelled",
          toStatus: "active",
        }),
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

  it("stamps statusChangedAt only for orders whose status actually changes", async () => {
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
        status: "ferdig",
        statusNotes: "",
        gdprHold: false,
      },
      {
        id: "order-2",
        companyId: "company-1",
        status: "confirmed",
        statusNotes: "",
        gdprHold: false,
      },
    ]);
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 2 });

    const res = await PATCH(
      new Request("http://localhost/api/orders/bulk", {
        method: "PATCH",
        body: JSON.stringify({
          orderIds: ["order-1", "order-2"],
          status: "completed",
        }),
      }),
    );

    expect(res.status).toBe(200);
    // order-1 is already completed (legacy "ferdig"), so only order-2 gets stamped.
    expect(mocks.orderUpdateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["order-2"] }, companyId: "company-1" },
      data: { statusChangedAt: expect.any(Date) },
    });
    expect(mocks.orderUpdateManyMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: expect.arrayContaining(["order-1"]) } }),
        data: { statusChangedAt: expect.any(Date) },
      }),
    );
  });

  describe("cancelled-order partner", () => {
    function setup() {
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
        { id: "no-partner", displayId: 20100, companyId: "company-1", status: "approved", statusNotes: "", subcontractorMembershipId: null, subcontractor: null, gdprHold: false },
        { id: "has-partner", companyId: "company-1", status: "approved", statusNotes: "", subcontractorMembershipId: "m-real", subcontractor: "Real", gdprHold: false },
        { id: "already-cancelled", companyId: "company-1", status: "kanselert", statusNotes: "", subcontractorMembershipId: null, subcontractor: null, gdprHold: false },
        { id: "legacy", displayId: 1234, companyId: "company-1", status: "approved", statusNotes: "", subcontractorMembershipId: null, subcontractor: null, gdprHold: false },
      ]);
      mocks.orderUpdateManyMock.mockResolvedValue({ count: 3 });
      mocks.findCancelledOrderPartnerMock.mockResolvedValue({
        subcontractorMembershipId: "membership-cancelled",
        subcontractor: "Kansellert",
      });
    }

    function bulk(body: Record<string, unknown>) {
      return PATCH(
        new Request("http://localhost/api/orders/bulk", {
          method: "PATCH",
          body: JSON.stringify({ orderIds: ["no-partner", "has-partner", "already-cancelled", "legacy"], ...body }),
        }),
      );
    }

    it("fills the placeholder partner only on orders moving into cancelled without one", async () => {
      setup();

      const res = await bulk({ status: "cancelled" });

      expect(res.status).toBe(200);
      expect(mocks.findCancelledOrderPartnerMock).toHaveBeenCalledWith(expect.anything(), "company-1");
      expect(mocks.orderUpdateManyMock).toHaveBeenCalledWith({
        where: { id: { in: ["no-partner"] }, companyId: "company-1" },
        data: { subcontractorMembershipId: "membership-cancelled", subcontractor: "Kansellert" },
      });
    });

    it("does not look up the placeholder when a bulk partner is chosen", async () => {
      setup();

      await bulk({ status: "cancelled", subcontractorId: "m-real" });

      expect(mocks.findCancelledOrderPartnerMock).not.toHaveBeenCalled();
    });
  });
});

describe("PATCH /api/orders/bulk — website order statuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "user-1", activeCompanyId: "company-1" });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      user: { username: "Admin", email: "admin@example.com" },
    });
    mocks.orderFindManyMock.mockResolvedValue([
      { id: "web-1", companyId: "company-1", status: "processing", statusNotes: "", isWebsiteOrder: true, gdprHold: false },
    ]);
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 1 });
    mocks.buildOrderEventSnapshotMock.mockImplementation((order) => ({ status: order.status ?? null }));
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([]);
    mocks.createManyOrderStatusChangedEventsMock.mockResolvedValue(undefined);
    mocks.orderNotificationUpdateManyMock.mockResolvedValue({ count: 0 });
    mocks.findCancelledOrderPartnerMock.mockResolvedValue(null);
  });

  function bulk(status: string) {
    return PATCH(
      new Request("http://localhost/api/orders/bulk", {
        method: "PATCH",
        body: JSON.stringify({ orderIds: ["web-1"], status }),
      }),
    );
  }

  it.each(["approved", "invoiced", "paid"])("refuses %s for a website order", async (status) => {
    const res = await bulk(status);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "WEBSITE_ORDER_STATUS_NOT_ALLOWED" });
    expect(mocks.orderUpdateManyMock).not.toHaveBeenCalled();
  });

  it("allows a website status", async () => {
    const res = await bulk("completed");

    expect(res.status).toBe(200);
  });
});
