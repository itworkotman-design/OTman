import { getRouteDistance } from "@/lib/integrations/mapbox/routeDistance";
import { routeAddressesChanged, type AdminOrderDetails } from "./websiteOrderDetailsEdit";

// The driving distance a website order is priced with after its details are
// edited (admin WebsiteOrderModal, customer "My order"): a typed override
// wins; otherwise it is recalculated when a stop moved — and the stored one
// kept when the route can't be worked out (an empty or unknown address, or
// Mapbox failing).
export async function resolveDrivingDistance(
  stored: {
    drivingDistance: string | null;
    pickupAddress: string | null;
    extraPickupAddress: string[];
    deliveryAddress: string | null;
  },
  details: AdminOrderDetails,
): Promise<string> {
  if (details.drivingDistanceOverride !== null) return details.drivingDistanceOverride;

  const storedDistance = stored.drivingDistance ?? "";
  const routable = details.pickups.length > 0 && details.pickups.every((stop) => stop.address) && !!details.delivery.address;
  if (!routable || !routeAddressesChanged(stored, details)) return storedDistance;

  try {
    const route = await getRouteDistance({
      pickupAddress: details.pickups[0]?.address,
      extraPickupAddresses: details.pickups.slice(1).map((stop) => stop.address),
      deliveryAddress: details.delivery.address,
    });
    return route ? route.distanceKm : storedDistance;
  } catch (err) {
    console.error("[resolveDrivingDistance] Route distance failed, keeping the stored distance:", err);
    return storedDistance;
  }
}
