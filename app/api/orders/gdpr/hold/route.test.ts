import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
  orderEventCreateManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    order: { findMany: mocks.orderFindManyMock, updateMany: mocks.orderUpdateManyMock },
    orderEvent: { createMany: mocks.orderEventCreateManyMock },
  },
}));

import { DELETE, POST } from "./route";

function adminSession() {
  mocks.getAuthenticatedSessionMock.mockResolvedValue({
    userId: "user-1",
    activeCompanyId: "company-1",
  });
  mocks.membershipFindFirstMock.mockResolvedValue({
    id: "membership-1",
    role: "ADMIN",
    user: { username: "Admin", email: "admin@example.com" },
  });
}

describe("POST /api/orders/gdpr/hold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 1 });
    mocks.orderEventCreateManyMock.mockResolvedValue({ count: 1 });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/orders/gdpr/hold", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"], reason: "Dispute" }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin membership", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "USER" });

    const res = await POST(
      new Request("http://localhost/api/orders/gdpr/hold", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"], reason: "Dispute" }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 when orderIds is empty", async () => {
    adminSession();

    const res = await POST(
      new Request("http://localhost/api/orders/gdpr/hold", {
        method: "POST",
        body: JSON.stringify({ orderIds: [], reason: "Dispute" }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "INVALID_ORDER_IDS" });
  });

  it("returns 400 when reason is blank", async () => {
    adminSession();

    const res = await POST(
      new Request("http://localhost/api/orders/gdpr/hold", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"], reason: "   " }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "HOLD_REASON_REQUIRED" });
    expect(mocks.orderUpdateManyMock).not.toHaveBeenCalled();
  });

  it("sets the hold and writes a GDPR_HOLD_SET audit event carrying the reason but not order PII", async () => {
    adminSession();
    mocks.orderFindManyMock.mockResolvedValue([
      { id: "order-1", companyId: "company-1" },
      { id: "order-2", companyId: "company-1" },
    ]);

    const res = await POST(
      new Request("http://localhost/api/orders/gdpr/hold", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1", "order-2"], reason: "Active dispute" }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, heldCount: 2 });

    expect(mocks.orderUpdateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["order-1", "order-2"] } },
      data: {
        gdprHold: true,
        gdprHoldReason: "Active dispute",
        gdprHoldSetAt: expect.any(Date),
      },
    });

    expect(mocks.orderEventCreateManyMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderId: "order-1",
          type: "GDPR_HOLD_SET",
          actorMembershipId: "membership-1",
          payload: { reason: "Active dispute" },
        }),
        expect.objectContaining({
          orderId: "order-2",
          type: "GDPR_HOLD_SET",
        }),
      ],
    });
  });
});

describe("DELETE /api/orders/gdpr/hold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 1 });
    mocks.orderEventCreateManyMock.mockResolvedValue({ count: 1 });
  });

  it("returns 400 when orderIds is empty", async () => {
    adminSession();

    const res = await DELETE(
      new Request("http://localhost/api/orders/gdpr/hold", {
        method: "DELETE",
        body: JSON.stringify({ orderIds: [] }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("clears the hold fields and writes a GDPR_HOLD_REMOVED audit event", async () => {
    adminSession();
    mocks.orderFindManyMock.mockResolvedValue([{ id: "order-1", companyId: "company-1" }]);

    const res = await DELETE(
      new Request("http://localhost/api/orders/gdpr/hold", {
        method: "DELETE",
        body: JSON.stringify({ orderIds: ["order-1"] }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, removedCount: 1 });

    expect(mocks.orderUpdateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["order-1"] } },
      data: { gdprHold: false, gdprHoldReason: null, gdprHoldSetAt: null },
    });
    expect(mocks.orderEventCreateManyMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ orderId: "order-1", type: "GDPR_HOLD_REMOVED" }),
      ],
    });
  });
});
