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

const FULL_ACCESS = {
  appAccess: [
    { module: "DASHBOARD", enabled: true, level: "ADMIN" },
    { module: "BOOKING", enabled: true, level: "ADMIN" },
  ],
  dashboardSections: [],
};

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

  it("returns company-scoped stats including store and subcontractor leaderboards, plus visibleSections", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      ...FULL_ACCESS,
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
      visibleSections: ["BOOKING_OVERVIEW", "QUICK_TASKS"],
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
        appAccess: {
          where: { module: { in: ["DASHBOARD", "BOOKING"] } },
          select: { module: true, enabled: true, level: true },
        },
        dashboardSections: {
          select: { section: true, enabled: true },
        },
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

  it("returns 200 with only orderEmailsEnabled when BOOKING_OVERVIEW is disabled but QUICK_TASKS stays visible", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      appAccess: FULL_ACCESS.appAccess,
      dashboardSections: [{ section: "BOOKING_OVERVIEW", enabled: false }],
      company: { orderEmailsEnabled: false },
    });

    const response = await GET(
      new Request("http://localhost/api/dashboard/home"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      visibleSections: ["QUICK_TASKS"],
      orderEmailsEnabled: false,
    });
    expect(mocks.orderCountMock).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when the caller has no DASHBOARD access", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      appAccess: [],
      dashboardSections: [],
      company: { orderEmailsEnabled: true },
    });

    const response = await GET(
      new Request("http://localhost/api/dashboard/home"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
    expect(mocks.orderCountMock).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN for a DASHBOARD grant without Booking-admin access", async () => {
    // DashboardHome's booking-derived sections (revenue, profit by
    // store/subcontractor, order email settings) require Booking-admin
    // regardless of the section toggle — a Dashboard-only grantee must not
    // see sensitive order data they have no other access to.
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      appAccess: [{ module: "DASHBOARD", enabled: true, level: "ADMIN" }],
      dashboardSections: [],
      company: { orderEmailsEnabled: true },
    });

    const response = await GET(
      new Request("http://localhost/api/dashboard/home"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
    expect(mocks.orderCountMock).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN for Booking-admin access without a DASHBOARD grant", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      appAccess: [{ module: "BOOKING", enabled: true, level: "ADMIN" }],
      dashboardSections: [],
      company: { orderEmailsEnabled: true },
    });

    const response = await GET(
      new Request("http://localhost/api/dashboard/home"),
    );

    expect(response.status).toBe(403);
  });

  it("returns 200 for a USER-role membership with DASHBOARD + Booking-admin grants", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      ...FULL_ACCESS,
      company: { orderEmailsEnabled: true },
    });
    mocks.orderCountMock.mockResolvedValue(0);
    mocks.orderFindManyMock.mockResolvedValue([]);
    mocks.orderGroupByMock.mockResolvedValue([]);
    mocks.membershipFindManyMock.mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/dashboard/home"),
    );

    expect(response.status).toBe(200);
  });

  it("PATCH updates the company order email toggle", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue(FULL_ACCESS);
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

  it("PATCH returns FORBIDDEN without Booking-admin access", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      appAccess: [{ module: "DASHBOARD", enabled: true, level: "ADMIN" }],
      dashboardSections: [],
    });

    const response = await PATCH(
      new Request("http://localhost/api/dashboard/home", {
        method: "PATCH",
        body: JSON.stringify({ orderEmailsEnabled: false }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.companyUpdateMock).not.toHaveBeenCalled();
  });
});
