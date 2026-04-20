import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOrderedRouteAddresses,
  getRouteDistance,
} from "@/lib/integrations/mapbox/routeDistance";

describe("buildOrderedRouteAddresses", () => {
  it("keeps stops in pickup, extra pickups, delivery, return order", () => {
    expect(
      buildOrderedRouteAddresses({
        pickupAddress: "Pickup 1",
        extraPickupAddresses: ["Pickup 2", "Pickup 3"],
        deliveryAddress: "Delivery 1",
        returnAddress: "Return 1",
      }),
    ).toEqual([
      "Pickup 1",
      "Pickup 2",
      "Pickup 3",
      "Delivery 1",
      "Return 1",
    ]);
  });

  it("omits blanks and the pickup placeholder", () => {
    expect(
      buildOrderedRouteAddresses({
        pickupAddress: "No shop pickup address",
        extraPickupAddresses: ["", "Pickup 2"],
        deliveryAddress: "Delivery 1",
        returnAddress: "",
      }),
    ).toEqual(["Pickup 2", "Delivery 1"]);
  });
});

describe("getRouteDistance", () => {
  const fetchMock = vi.fn();
  const originalMapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    process.env.MAPBOX_ACCESS_TOKEN = "test-mapbox-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (typeof originalMapboxToken === "string") {
      process.env.MAPBOX_ACCESS_TOKEN = originalMapboxToken;
      return;
    }

    delete process.env.MAPBOX_ACCESS_TOKEN;
  });

  it("returns null when fewer than two usable stops exist", async () => {
    await expect(
      getRouteDistance({
        pickupAddress: "No shop pickup address",
        extraPickupAddresses: [],
        deliveryAddress: "Delivery 1",
        returnAddress: "",
      }),
    ).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("geocodes each stop and returns the directions distance in km", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            features: [
              {
                geometry: {
                  coordinates: [10.1, 59.1],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            features: [
              {
                routable_points: [
                  {
                    coordinates: [10.2, 59.2],
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [
              {
                distance: 123456,
              },
            ],
            code: "Ok",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const result = await getRouteDistance({
      pickupAddress: "Pickup 1",
      extraPickupAddresses: [],
      deliveryAddress: "Delivery 1",
      returnAddress: "",
    });

    expect(result).toEqual({
      distanceKm: "123.46",
      stopAddresses: ["Pickup 1", "Delivery 1"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toContain(
      "/directions/v5/mapbox/driving/10.1,59.1;10.2,59.2",
    );
  });
});
