import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderCountMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderGroupByMock: vi.fn(),
  orderAggregateMock: vi.fn(),
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
      count: mocks.orderCountMock,
      findMany: mocks.orderFindManyMock,
      groupBy: mocks.orderGroupByMock,
      aggregate: mocks.orderAggregateMock,
    },
  },
}));

import { GET } from "./route";

describe("GET /api/dashboard/home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/dashboard/home"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("returns company-scoped stats including unread inbound email count", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      role: "ADMIN",
    });
    mocks.orderCountMock
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    mocks.orderFindManyMock.mockResolvedValue([
      {
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        priceExVat: 1000,
      },
      {
        createdAt: new Date("2026-04-03T12:00:00.000Z"),
        priceExVat: 2500,
      },
    ]);
    mocks.orderGroupByMock.mockResolvedValue([
      {
        status: "behandles",
        _count: {
          status: 2,
        },
      },
    ]);
    mocks.orderAggregateMock.mockResolvedValue({
      _sum: {
        unreadInboundEmailCount: 5,
      },
    });

    const response = await GET(
      new Request("http://localhost/api/dashboard/home"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      stats: {
        totalIncome: 3500,
        ordersThisMonth: 12,
        completedOrders: 4,
        activeOrders: 3,
        pendingOrders: 2,
        cancelledOrders: 1,
        bookingEmailCount: 5,
      },
      statusBreakdown: [
        {
          status: "behandles",
          count: 2,
        },
      ],
      dailyActivity: expect.arrayContaining([
        {
          date: "2026-04-01",
          orders: 1,
          revenue: 1000,
        },
        {
          date: "2026-04-03",
          orders: 1,
          revenue: 2500,
        },
      ]),
    });

    expect(mocks.membershipFindFirstMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        companyId: "company-1",
        status: "ACTIVE",
      },
      select: {
        role: true,
      },
    });

    expect(mocks.orderAggregateMock).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        unreadInboundEmailCount: {
          gt: 0,
        },
      },
      _sum: {
        unreadInboundEmailCount: true,
      },
    });
  });
});
