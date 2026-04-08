import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canEditOrdersMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  orderDeleteManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/users/orderAccess", () => ({
  canEditOrders: mocks.canEditOrdersMock,
}));

vi.mock("@/lib/orders/buildOrderSummaries", () => ({
  buildOrderSummaries: vi.fn(),
}));

vi.mock("@/lib/orders/buildOrderItemsFromCards", () => ({
  buildOrderItemsFromCards: vi.fn(),
}));

vi.mock("@/lib/booking/catalog/getBookingCatalog", () => ({
  getBookingCatalog: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    order: {
      findFirst: mocks.orderFindFirstMock,
      deleteMany: mocks.orderDeleteManyMock,
    },
  },
}));

import { DELETE, GET, PATCH } from "./route";

describe("routes in /api/orders/[orderId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEditOrdersMock.mockReturnValue(true);
  });

  it("GET returns 404 when the order does not exist", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.orderFindFirstMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/orders/order-1"), {
      params: Promise.resolve({ orderId: "order-1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
  });

  it("PATCH returns 400 when product cards are missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      priceListId: "price-list-1",
      permissions: [{ permission: "BOOKING_CREATE" }],
    });

    const res = await PATCH(
      new Request("http://localhost/api/orders/order-1", {
        method: "PATCH",
        body: JSON.stringify({ productCards: [] }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_PRODUCT_CARDS",
    });
  });

  it("DELETE returns 404 when no order row is removed", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "OWNER" });
    mocks.orderDeleteManyMock.mockResolvedValue({ count: 0 });

    const res = await DELETE(new Request("http://localhost/api/orders/order-1"), {
      params: Promise.resolve({ orderId: "order-1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "ORDER_NOT_FOUND",
    });
  });
});
