import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
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
      updateMany: mocks.orderUpdateManyMock,
    },
  },
}));

import { PATCH } from "./route";

describe("PATCH /api/orders/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when no valid order ids are provided", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN" });

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
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "OWNER" });
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
      },
    });
  });
});
