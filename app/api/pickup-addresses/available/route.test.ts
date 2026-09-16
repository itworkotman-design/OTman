import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  getActiveMembershipMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/auth/membership", () => ({
  getActiveMembership: mocks.getActiveMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    customPickupAddress: { findMany: mocks.findManyMock },
  },
}));

import { GET } from "./route";

describe("GET /api/pickup-addresses/available", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/pickup-addresses/available"));

    expect(response.status).toBe(401);
  });

  it("returns 409 when no active company is selected", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "user-1", activeCompanyId: null });

    const response = await GET(new Request("http://localhost/api/pickup-addresses/available"));

    expect(response.status).toBe(409);
  });

  it("only returns addresses directly assigned to the caller when they lack full access", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "user-1", activeCompanyId: "company-1" });
    mocks.getActiveMembershipMock.mockResolvedValue({ role: "USER", permissions: [] });
    mocks.findManyMock.mockResolvedValue([
      {
        id: "cpa-1",
        name: "Power Storo",
        address: "Storo Storsenter 1",
        latitude: 59.945,
        longitude: 10.7669,
        icon: "storefront",
        color: "blue",
        phone: "22334455",
      },
    ]);

    const response = await GET(new Request("http://localhost/api/pickup-addresses/available"));
    const json = await response.json();

    expect(mocks.findManyMock).toHaveBeenCalledWith({
      where: { isActive: true, users: { some: { userId: "user-1" } } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        icon: true,
        color: true,
        phone: true,
      },
    });
    expect(response.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      pickupAddresses: [
        {
          id: "cpa-1",
          name: "Power Storo",
          address: "Storo Storsenter 1",
          latitude: 59.945,
          longitude: 10.7669,
          icon: "storefront",
          color: "blue",
          phone: "22334455",
        },
      ],
    });
  });

  it("returns every active pickup address for a full-access caller, regardless of assignment", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "owner-1", activeCompanyId: "company-1" });
    mocks.getActiveMembershipMock.mockResolvedValue({ role: "OWNER", permissions: [] });
    mocks.findManyMock.mockResolvedValue([
      {
        id: "cpa-1",
        name: "Power Storo",
        address: "Storo Storsenter 1",
        latitude: 59.945,
        longitude: 10.7669,
        icon: "storefront",
        color: "blue",
      },
      {
        id: "cpa-2",
        name: "Another Depot",
        address: "Somewhere else",
        latitude: 60.1,
        longitude: 10.2,
        icon: "storefront",
        color: "blue",
      },
    ]);

    const response = await GET(new Request("http://localhost/api/pickup-addresses/available"));
    const json = await response.json();

    expect(mocks.findManyMock).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        icon: true,
        color: true,
        phone: true,
      },
    });
    expect(response.status).toBe(200);
    expect(json.pickupAddresses).toHaveLength(2);
  });

  it("treats a missing membership the same as no full access", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "user-1", activeCompanyId: "company-1" });
    mocks.getActiveMembershipMock.mockResolvedValue(null);
    mocks.findManyMock.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/pickup-addresses/available"));

    expect(mocks.findManyMock).toHaveBeenCalledWith({
      where: { isActive: true, users: { some: { userId: "user-1" } } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        icon: true,
        color: true,
        phone: true,
      },
    });
  });
});
