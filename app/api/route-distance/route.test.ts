import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  getRouteDistanceMock: vi.fn(),
  getVisibleCustomPickupAddressMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/integrations/mapbox/routeDistance", () => ({
  getRouteDistance: mocks.getRouteDistanceMock,
}));

vi.mock("@/lib/pickupAddresses/visibility", () => ({
  getVisibleCustomPickupAddress: mocks.getVisibleCustomPickupAddressMock,
}));

import { POST } from "./route";

describe("POST /api/route-distance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/route-distance", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("returns the computed route distance for the ordered stops", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.getRouteDistanceMock.mockResolvedValue({
      distanceKm: "42.10",
      stopAddresses: ["Pickup 1", "Pickup 2", "Delivery 1", "Return 1"],
    });

    const response = await POST(
      new Request("http://localhost/api/route-distance", {
        method: "POST",
        body: JSON.stringify({
          pickupAddress: "Pickup 1",
          extraPickupAddresses: ["Pickup 2"],
          deliveryAddress: "Delivery 1",
          returnAddress: "Return 1",
        }),
      }),
    );

    expect(mocks.getRouteDistanceMock).toHaveBeenCalledWith({
      pickupAddress: "Pickup 1",
      extraPickupAddresses: ["Pickup 2"],
      deliveryAddress: "Delivery 1",
      returnAddress: "Return 1",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      distanceKm: "42.10",
      stopAddresses: ["Pickup 1", "Pickup 2", "Delivery 1", "Return 1"],
    });
  });

  it("resolves a custom pickup address server-side and passes its coordinate through", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.getVisibleCustomPickupAddressMock.mockResolvedValue({
      id: "cpa-1",
      name: "Power Storo",
      address: "Storo Storsenter 1, Oslo",
      latitude: 59.945,
      longitude: 10.7669,
    });
    mocks.getRouteDistanceMock.mockResolvedValue({
      distanceKm: "5.00",
      stopAddresses: ["Storo Storsenter 1, Oslo", "Delivery 1"],
    });

    const response = await POST(
      new Request("http://localhost/api/route-distance", {
        method: "POST",
        body: JSON.stringify({
          customPickupAddressId: "cpa-1",
          deliveryAddress: "Delivery 1",
        }),
      }),
    );

    expect(mocks.getVisibleCustomPickupAddressMock).toHaveBeenCalledWith(
      "cpa-1",
      "user-1",
    );
    expect(mocks.getRouteDistanceMock).toHaveBeenCalledWith({
      pickupAddress: "Storo Storsenter 1, Oslo",
      pickupCoordinate: { latitude: 59.945, longitude: 10.7669 },
      extraPickupAddresses: [],
      deliveryAddress: "Delivery 1",
      returnAddress: "",
    });
    expect(response.status).toBe(200);
  });

  it("resolves a custom return address server-side and passes its coordinate through", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.getVisibleCustomPickupAddressMock.mockResolvedValue({
      id: "cpa-2",
      name: "Power Storo",
      address: "Storo Storsenter 1, Oslo",
      latitude: 59.945,
      longitude: 10.7669,
    });
    mocks.getRouteDistanceMock.mockResolvedValue({
      distanceKm: "5.00",
      stopAddresses: ["Pickup 1", "Storo Storsenter 1, Oslo"],
    });

    const response = await POST(
      new Request("http://localhost/api/route-distance", {
        method: "POST",
        body: JSON.stringify({
          pickupAddress: "Pickup 1",
          customReturnAddressId: "cpa-2",
        }),
      }),
    );

    expect(mocks.getVisibleCustomPickupAddressMock).toHaveBeenCalledWith("cpa-2", "user-1");
    expect(mocks.getRouteDistanceMock).toHaveBeenCalledWith({
      pickupAddress: "Pickup 1",
      pickupCoordinate: undefined,
      extraPickupAddresses: [],
      deliveryAddress: "",
      returnAddress: "Storo Storsenter 1, Oslo",
      returnCoordinate: { latitude: 59.945, longitude: 10.7669 },
    });
    expect(response.status).toBe(200);
  });

  it("returns 403 when the custom return address isn't visible to the caller", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.getVisibleCustomPickupAddressMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/route-distance", {
        method: "POST",
        body: JSON.stringify({
          customReturnAddressId: "cpa-unauthorized",
          pickupAddress: "Pickup 1",
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "RETURN_ADDRESS_NOT_AVAILABLE",
    });
    expect(mocks.getRouteDistanceMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the custom pickup address isn't visible to the caller's store", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.getVisibleCustomPickupAddressMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/route-distance", {
        method: "POST",
        body: JSON.stringify({
          customPickupAddressId: "cpa-unauthorized",
          deliveryAddress: "Delivery 1",
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "PICKUP_ADDRESS_NOT_AVAILABLE",
    });
    expect(mocks.getRouteDistanceMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the Mapbox token is missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.getRouteDistanceMock.mockRejectedValue(
      new Error("MAPBOX_ACCESS_TOKEN_MISSING"),
    );

    const response = await POST(
      new Request("http://localhost/api/route-distance", {
        method: "POST",
        body: JSON.stringify({ deliveryAddress: "Delivery 1" }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "MAPBOX_ACCESS_TOKEN_MISSING",
    });
  });
});
