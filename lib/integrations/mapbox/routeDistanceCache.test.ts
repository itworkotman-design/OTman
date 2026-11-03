import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getRouteDistance: vi.fn() }));
vi.mock("./routeDistance", () => ({ getRouteDistance: mocks.getRouteDistance }));

import { clearRouteDistanceCache, getCachedRouteDistance, ROUTE_DISTANCE_CACHE_MS } from "./routeDistanceCache";

const stops = { pickupAddress: "Storgata 1, Oslo", extraPickupAddresses: ["Kirkegata 2, Oslo"], deliveryAddress: "Torget 3, Drammen" };

describe("getCachedRouteDistance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRouteDistanceCache();
    mocks.getRouteDistance.mockResolvedValue({ distanceKm: "42.86", stopAddresses: [] });
  });

  it("asks Mapbox once per route: the price shown and the order booked use the same distance", async () => {
    const now = new Date("2026-11-03T12:00:00Z");

    const shown = await getCachedRouteDistance(stops, now);
    // Same stops, typed with other spacing/case, a few minutes later.
    const booked = await getCachedRouteDistance(
      { pickupAddress: " storgata 1, oslo ", extraPickupAddresses: ["Kirkegata 2, Oslo "], deliveryAddress: "TORGET 3, Drammen" },
      new Date(now.getTime() + 5 * 60_000),
    );

    expect(shown).toBe("42.86");
    expect(booked).toBe("42.86");
    expect(mocks.getRouteDistance).toHaveBeenCalledTimes(1);
    expect(mocks.getRouteDistance).toHaveBeenCalledWith(stops);
  });

  it("asks again for different stops, or once the remembered distance is too old", async () => {
    const now = new Date("2026-11-03T12:00:00Z");
    await getCachedRouteDistance(stops, now);

    await getCachedRouteDistance({ ...stops, extraPickupAddresses: [] }, now);
    await getCachedRouteDistance(stops, new Date(now.getTime() + ROUTE_DISTANCE_CACHE_MS + 1));

    expect(mocks.getRouteDistance).toHaveBeenCalledTimes(3);
  });

  it("never remembers a failed lookup or a route Mapbox can't build", async () => {
    mocks.getRouteDistance.mockRejectedValueOnce(new Error("MAPBOX_DIRECTIONS_NO_ROUTE"));
    await expect(getCachedRouteDistance(stops)).rejects.toThrow("MAPBOX_DIRECTIONS_NO_ROUTE");

    mocks.getRouteDistance.mockResolvedValueOnce(null);
    expect(await getCachedRouteDistance(stops)).toBe("");

    expect(await getCachedRouteDistance(stops)).toBe("42.86");
    expect(mocks.getRouteDistance).toHaveBeenCalledTimes(3);
  });
});
