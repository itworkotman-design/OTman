import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  getRouteDistanceMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/integrations/mapbox/routeDistance", () => ({
  getRouteDistance: mocks.getRouteDistanceMock,
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
