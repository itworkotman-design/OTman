# Mapbox Route Distance

## Source

- `lib/integrations/mapbox/routeDistance.ts`

## Responsibility

Builds the ordered stop list for booking distance calculation, geocodes each usable address with Mapbox, and computes the final driving distance with the Mapbox Directions API.

## Functions

| Function | Description |
| --- | --- |
| `normalizeRouteAddress` | Removes blank values and the `No shop pickup address` placeholder from route calculation. |
| `parseCoordinatePair` | Validates unknown coordinate payloads from Mapbox responses before they are used in routing. |
| `buildOrderedRouteAddresses` | Orders usable stops as pickup, extra pickups, delivery, and return. |
| `geocodeAddress` | Resolves a single address string to a routable or geometric coordinate with temporary Mapbox geocoding. |
| `getDirectionsDistanceMeters` | Requests the ordered route from the Mapbox Directions API and returns its total distance in meters. |
| `getRouteDistance` | Produces the final ordered stop list and formatted kilometer distance, or `null` when fewer than two usable stops exist. |
