import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  membershipFindManyMock: vi.fn(),
  companyUpdateMock: vi.fn(),
  orderCountMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderGroupByMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
      findMany: mocks.membershipFindManyMock,
    },
    company: {
      update: mocks.companyUpdateMock,
    },
    order: {
      count: mocks.orderCountMock,
      findMany: mocks.orderFindManyMock,
      groupBy: mocks.orderGroupByMock,
    },
  },
}));

import { GET, PATCH } from "./route";

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

  it("returns company-scoped stats including store and subcontractor leaderboards", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      role: "ADMIN",
      company: {
        orderEmailsEnabled: true,
      },
    });
    mocks.orderCountMock
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1);
    mocks.orderFindManyMock
      .mockResolvedValueOnce([
        {
          createdAt: new Date("2026-07-01T10:00:00.000Z"),
          priceExVat: 1000,
          priceSubcontractor: 400,
        },
        {
          createdAt: new Date("2026-07-03T12:00:00.000Z"),
          priceExVat: 2500,
          priceSubcontractor: 3000,
        },
      ])
      .mockResolvedValueOnce([
        {
          createdAt: new Date("2026-07-01T10:00:00.000Z"),
          priceExVat: 1000,
          priceSubcontractor: 400,
          customerMembershipId: "cust-1",
          subcontractorMembershipId: "sub-1",
        },
        {
          createdAt: new Date("2026-07-03T12:00:00.000Z"),
          priceExVat: 2500,
          priceSubcontractor: 3000,
          customerMembershipId: "cust-1",
          subcontractorMembershipId: "sub-2",
        },
        {
          createdAt: new Date("2025-07-05T10:00:00.000Z"),
          priceExVat: 800,
          priceSubcontractor: 200,
          customerMembershipId: "cust-2",
          subcontractorMembershipId: "sub-1",
        },
      ]);
    mocks.orderGroupByMock.mockResolvedValue([
      {
        status: "processing",
        _count: {
          status: 2,
        },
      },
    ]);
    mocks.membershipFindManyMock.mockResolvedValue([
      { id: "cust-1", user: { email: "cust1@example.com", username: "StoreOne" } },
      { id: "sub-1", user: { email: "sub1@example.com", username: "SubOne" } },
      { id: "sub-2", user: { email: "sub2@example.com", username: null } },
    ]);

    const response = await GET(
      new Request("http://localhost/api/dashboard/home"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      stats: {
        totalIncome: 100,
        ordersThisMonth: 12,
        completedOrders: 4,
        activeOrders: 3,
        pendingOrders: 2,
        confirmedOrders: 5,
        cancelledOrders: 1,
      },
      orderEmailsEnabled: true,
      statusBreakdown: [
        {
          status: "processing",
          count: 2,
        },
      ],
      monthlyRevenue: expect.arrayContaining([
        {
          month: 7,
          monthLabel: "Jul",
          subcontractor: 3400,
          profit: 100,
          lastYearSubcontractor: 200,
          lastYearProfit: 600,
        },
      ]),
      monthlyComparison: expect.arrayContaining([
        {
          month: 7,
          monthLabel: "Jul",
          currentYearOrders: 2,
          lastYearOrders: 1,
        },
      ]),
      storeLeaderboard: [
        {
          membershipId: "cust-1",
          username: "StoreOne",
          orderCount: 2,
          profit: 100,
        },
      ],
      subcontractorLeaderboard: [
        {
          membershipId: "sub-1",
          username: "SubOne",
          orderCount: 1,
          profit: 600,
        },
        {
          membershipId: "sub-2",
          username: "sub2@example.com",
          orderCount: 1,
          profit: -500,
        },
      ],
      currentYear: 2026,
      lastYear: 2025,
    });

    expect(mocks.membershipFindFirstMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        companyId: "company-1",
        status: "ACTIVE",
      },
      select: {
        role: true,
        company: {
          select: {
            orderEmailsEnabled: true,
          },
        },
      },
    });

    expect(mocks.membershipFindManyMock).toHaveBeenCalledWith({
      where: {
        id: { in: ["cust-1", "sub-1", "sub-2"] },
        companyId: "company-1",
      },
      select: {
        id: true,
        user: {
          select: {
            email: true,
            username: true,
          },
        },
      },
    });
  });

  it("PATCH updates the company order email toggle", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      role: "ADMIN",
    });
    mocks.companyUpdateMock.mockResolvedValue({
      orderEmailsEnabled: false,
    });

    const response = await PATCH(
      new Request("http://localhost/api/dashboard/home", {
        method: "PATCH",
        body: JSON.stringify({
          orderEmailsEnabled: false,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      orderEmailsEnabled: false,
    });
    expect(mocks.companyUpdateMock).toHaveBeenCalledWith({
      where: {
        id: "company-1",
      },
      data: {
        orderEmailsEnabled: false,
      },
      select: {
        orderEmailsEnabled: true,
      },
    });
  });
});
