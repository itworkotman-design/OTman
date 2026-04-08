import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
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
      findMany: mocks.orderFindManyMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { POST } from "./route";

describe("POST /api/orders/duplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when no order ids are supplied", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN" });

    const res = await POST(
      new Request("http://localhost/api/orders/duplicate", {
        method: "POST",
        body: JSON.stringify({ orderIds: [] }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_ORDER_IDS",
    });
  });

  it("returns 404 when the requested source orders are missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "OWNER" });
    mocks.orderFindManyMock.mockResolvedValue([]);

    const res = await POST(
      new Request("http://localhost/api/orders/duplicate", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"] }),
      }),
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "ORDERS_NOT_FOUND",
    });
  });
});
