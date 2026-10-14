# `lib/orders/movingDrivingDistance.ts`

## Purpose
`lookUpMovingDrivingDistance(pickup, delivery)` — pickup → delivery km via Mapbox (`getRouteDistance`), `""` when the
lookup fails (no km charged, logged). Always looked up server side, never taken from the client.
