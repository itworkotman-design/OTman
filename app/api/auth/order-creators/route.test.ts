import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: { membership: { findMany: mocks.findManyMock } },
}));

import { GET } from "./route";

describe("GET /api/auth/order-creators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
  });

  it("uses the plain user address when no main pickup address is assigned", async () => {
    mocks.findManyMock.mockResolvedValue([
      {
        id: "membership-1",
        role: "OWNER",
        legacyWordpressUserId: null,
        warehouseEmail: null,
        user: { email: "a@example.com", username: "A", address: "Some street 1", mainPickupAddress: null },
        permissions: [],
      },
    ]);

    const response = await GET(new Request("http://localhost/api/auth/order-creators"));
    const json = await response.json();

    expect(json.orderCreators[0]).toEqual(
      expect.objectContaining({ address: "Some street 1", mainPickupAddress: null }),
    );
  });

  it("uses the active main pickup address's address/coordinates and exposes it for the order flow", async () => {
    mocks.findManyMock.mockResolvedValue([
      {
        id: "membership-1",
        role: "OWNER",
        legacyWordpressUserId: null,
        warehouseEmail: null,
        user: {
          email: "a@example.com",
          username: "A",
          address: "Some street 1",
          mainPickupAddress: {
            id: "cpa-1",
            name: "Power Storo",
            address: "Storo Storsenter 1, 0587 Oslo",
            latitude: 59.945,
            longitude: 10.7669,
            isActive: true,
          },
        },
        permissions: [],
      },
    ]);

    const response = await GET(new Request("http://localhost/api/auth/order-creators"));
    const json = await response.json();

    expect(json.orderCreators[0]).toEqual(
      expect.objectContaining({
        address: "Storo Storsenter 1, 0587 Oslo",
        mainPickupAddress: {
          id: "cpa-1",
          name: "Power Storo",
          address: "Storo Storsenter 1, 0587 Oslo",
          latitude: 59.945,
          longitude: 10.7669,
        },
      }),
    );
  });

  it("falls back to the plain user address when the main pickup address is inactive", async () => {
    mocks.findManyMock.mockResolvedValue([
      {
        id: "membership-1",
        role: "OWNER",
        legacyWordpressUserId: null,
        warehouseEmail: null,
        user: {
          email: "a@example.com",
          username: "A",
          address: "Some street 1",
          mainPickupAddress: {
            id: "cpa-1",
            name: "Power Storo",
            address: "Storo Storsenter 1, 0587 Oslo",
            latitude: 59.945,
            longitude: 10.7669,
            isActive: false,
          },
        },
        permissions: [],
      },
    ]);

    const response = await GET(new Request("http://localhost/api/auth/order-creators"));
    const json = await response.json();

    expect(json.orderCreators[0]).toEqual(
      expect.objectContaining({ address: "Some street 1", mainPickupAddress: null }),
    );
  });

  it("exposes the user's active main return address for the order flow", async () => {
    mocks.findManyMock.mockResolvedValue([
      {
        id: "membership-1",
        role: "OWNER",
        legacyWordpressUserId: null,
        warehouseEmail: null,
        user: {
          email: "a@example.com",
          username: "A",
          address: "Some street 1",
          mainPickupAddress: null,
          mainReturnAddress: {
            id: "ret-1",
            name: "Gjenvinning Alna",
            address: "Alna 1, Oslo",
            latitude: 59.93,
            longitude: 10.85,
            isActive: true,
          },
        },
        permissions: [],
      },
    ]);

    const response = await GET(new Request("http://localhost/api/auth/order-creators"));
    const json = await response.json();

    expect(json.orderCreators[0].mainReturnAddress).toEqual({
      id: "ret-1",
      name: "Gjenvinning Alna",
      address: "Alna 1, Oslo",
      latitude: 59.93,
      longitude: 10.85,
    });
  });

  it("ignores an inactive main return address", async () => {
    mocks.findManyMock.mockResolvedValue([
      {
        id: "membership-1",
        role: "OWNER",
        legacyWordpressUserId: null,
        warehouseEmail: null,
        user: {
          email: "a@example.com",
          username: "A",
          address: "Some street 1",
          mainPickupAddress: null,
          mainReturnAddress: {
            id: "ret-1",
            name: "Gjenvinning Alna",
            address: "Alna 1, Oslo",
            latitude: 59.93,
            longitude: 10.85,
            isActive: false,
          },
        },
        permissions: [],
      },
    ]);

    const response = await GET(new Request("http://localhost/api/auth/order-creators"));
    const json = await response.json();

    expect(json.orderCreators[0].mainReturnAddress).toBeNull();
  });
});
