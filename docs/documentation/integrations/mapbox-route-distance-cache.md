# Mapbox Route Distance Cache

## Source

- `lib/integrations/mapbox/routeDistanceCache.ts`
- `lib/orders/websiteDrivingDistance.ts` (the never-throwing wrapper the booking routes use)

## Responsibility

A homepage order's km charge is always priced from a distance the server looked up, never from one the browser sends. The distance is looked up twice: once to show the customer their price (`/api/site/route-distance`), and again when they book (`white-goods-order`, `moving-request`, through `lookUpWebsiteDrivingDistance`). Both go through this cache, so the booking normally reuses the distance the price was shown with, and a failed second Mapbox call can't change the price (`409 PRICE_CHANGED`).

- Keyed by the stops in order (pickup, extra pickups, delivery), trimmed, whitespace-collapsed and lowercased.
- Remembered for `ROUTE_DISTANCE_CACHE_MS` (1 hour), at most 1000 routes, oldest dropped first.
- Per server process: after a restart, or on another instance, it simply asks Mapbox again.
- Failed lookups and unroutable stops (`""`) are never remembered.

The moving admin edit and "My order" edit (`lookUpMovingDrivingDistance`) use it too.

## Functions

| Function | Description |
| --- | --- |
| `getCachedRouteDistance(stops, now?)` | The distance in km, or `""` when there's no route. Throws when the lookup fails. |
| `clearRouteDistanceCache()` | Empties it (tests). |
| `lookUpWebsiteDrivingDistance(stops)` | The above, returning `""` (logged) instead of throwing. |
