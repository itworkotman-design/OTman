import { getRouteDistance } from "./routeDistance";

// The driving distance of a homepage route, remembered per stops for a while.
// The price a customer is shown (/api/site/route-distance) and the order they
// then book (white-goods-order, moving-request) are both priced server side
// from Mapbox; this makes the booking reuse the distance the price was shown
// with instead of asking Mapbox again, so a failed second lookup can't change
// the price. Per server process: a miss (restart, another instance) just asks
// Mapbox again. Failures and unroutable stops are never remembered.

export const ROUTE_DISTANCE_CACHE_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 1000;

type RouteStops = {
  pickupAddress: string;
  extraPickupAddresses?: string[];
  deliveryAddress: string;
};

const cache = new Map<string, { distanceKm: string; at: number }>();

function cacheKey(stops: RouteStops): string {
  const norm = (address: string) => address.trim().replace(/\s+/g, " ").toLocaleLowerCase("nb-NO");
  return JSON.stringify([
    norm(stops.pickupAddress),
    ...(stops.extraPickupAddresses ?? []).map(norm),
    norm(stops.deliveryAddress),
  ]);
}

// The distance in km as Mapbox returns it, or "" when there's no route.
// Throws when the lookup itself fails (as getRouteDistance does).
export async function getCachedRouteDistance(stops: RouteStops, now: Date = new Date()): Promise<string> {
  const key = cacheKey(stops);
  const hit = cache.get(key);
  if (hit && now.getTime() - hit.at <= ROUTE_DISTANCE_CACHE_MS) return hit.distanceKm;

  const result = await getRouteDistance(stops);
  const distanceKm = result?.distanceKm ?? "";
  if (distanceKm) {
    cache.delete(key);
    cache.set(key, { distanceKm, at: now.getTime() });
    // Oldest first (insertion order).
    if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  }
  return distanceKm;
}

export function clearRouteDistanceCache(): void {
  cache.clear();
}
