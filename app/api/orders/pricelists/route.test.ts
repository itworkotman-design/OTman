import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canCreateOrdersMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  priceListFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/users/orderAccess", () => ({
  canCreateOrders: mocks.canCreateOrdersMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    order: {
      findMany: mocks.orderFindManyMock,
    },
    priceList: {
      findMany: mocks.priceListFindManyMock,
    },
  },
}));

import { GET } from "./route";

describe("GET /api/orders/pricelists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canCreateOrdersMock.mockReturnValue(false);
    mocks.orderFindManyMock.mockResolvedValue([]);
    mocks.priceListFindManyMock.mockResolvedValue([]);
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/orders/pricelists"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("returns 409 when there is no active company selected", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: null,
    });

    const res = await GET(new Request("http://localhost/api/orders/pricelists"));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "TENANT_SELECTION_REQUIRED",
    });
  });

  it("returns 403 when the user has no active membership", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/orders/pricelists"));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
  });

  it("scopes admins to the whole company with no membership restriction", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "admin-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "admin-membership",
      role: "ADMIN",
      permissions: [],
    });

    await GET(new Request("http://localhost/api/orders/pricelists"));

    expect(mocks.orderFindManyMock).toHaveBeenCalledWith({
      where: { companyId: "company-1", priceListId: { not: null } },
      distinct: ["priceListId"],
      select: { priceListId: true },
    });
  });

  it("scopes order creators to their customer or creator membership", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "creator-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "creator-membership",
      role: "USER",
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.canCreateOrdersMock.mockReturnValue(true);

    await GET(new Request("http://localhost/api/orders/pricelists"));

    expect(mocks.orderFindManyMock).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        priceListId: { not: null },
        OR: [
          { customerMembershipId: "creator-membership" },
          { createdByMembershipId: "creator-membership" },
        ],
      },
      distinct: ["priceListId"],
      select: { priceListId: true },
    });
  });

  it("scopes subcontractors to their own assigned orders", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "sub-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "sub-membership",
      role: "USER",
      permissions: [],
    });
    mocks.canCreateOrdersMock.mockReturnValue(false);

    await GET(new Request("http://localhost/api/orders/pricelists"));

    expect(mocks.orderFindManyMock).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        priceListId: { not: null },
        subcontractorMembershipId: "sub-membership",
      },
      distinct: ["priceListId"],
      select: { priceListId: true },
    });
  });

  it("resolves distinct pricelist ids to names, sorted by name", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "admin-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "admin-membership",
      role: "ADMIN",
      permissions: [],
    });
    mocks.orderFindManyMock.mockResolvedValue([
      { priceListId: "price-list-1" },
      { priceListId: "price-list-2" },
    ]);
    mocks.priceListFindManyMock.mockResolvedValue([
      { id: "price-list-1", name: "Zulu" },
      { id: "price-list-2", name: "Alpha" },
    ]);

    const res = await GET(new Request("http://localhost/api/orders/pricelists"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      pricelists: [
        { id: "price-list-2", name: "Alpha" },
        { id: "price-list-1", name: "Zulu" },
      ],
    });
    expect(mocks.priceListFindManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["price-list-1", "price-list-2"] } },
      select: { id: true, name: true },
    });
  });

  it("returns an empty list without querying pricelists when no visible order has one", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "admin-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "admin-membership",
      role: "ADMIN",
      permissions: [],
    });
    mocks.orderFindManyMock.mockResolvedValue([]);

    const res = await GET(new Request("http://localhost/api/orders/pricelists"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, pricelists: [] });
    expect(mocks.priceListFindManyMock).not.toHaveBeenCalled();
  });
});
