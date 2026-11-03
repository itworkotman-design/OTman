import { lookUpWebsiteDrivingDistance } from "@/lib/orders/websiteDrivingDistance";

// A move's driving distance pickup → delivery (km, as Mapbox returns it), or
// "" when the lookup fails — then no km is charged (logged; staff review every
// website order anyway). Looked up server side by the booking route and the
// admin edit, never taken from the client.
export async function lookUpMovingDrivingDistance(pickupAddress: string, deliveryAddress: string): Promise<string> {
  return lookUpWebsiteDrivingDistance({ pickupAddress, deliveryAddress });
}
