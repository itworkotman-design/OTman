import { getCachedRouteDistance } from "@/lib/integrations/mapbox/routeDistanceCache";

// A homepage order's driving distance (km, as Mapbox returns it) through its
// stops in order: pickup, extra pickups, delivery. "" when the lookup fails
// (logged). Looked up server side when the order is booked, never taken from
// the client, and through the same cache as the price the customer was shown
// (/api/site/route-distance), so both use one distance.
export async function lookUpWebsiteDrivingDistance(stops: {
  pickupAddress: string;
  extraPickupAddresses?: string[];
  deliveryAddress: string;
}): Promise<string> {
  try {
    return await getCachedRouteDistance({
      pickupAddress: stops.pickupAddress.trim(),
      extraPickupAddresses: (stops.extraPickupAddresses ?? []).map((address) => address.trim()),
      deliveryAddress: stops.deliveryAddress.trim(),
    });
  } catch (err) {
    console.error("[website order] Driving distance lookup failed:", err);
    return "";
  }
}
