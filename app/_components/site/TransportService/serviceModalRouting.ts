// Which booking modal a homepage service card opens. Kept framework-free so
// the card -> modal mapping can be unit tested without React.

export type ServiceModalKind = "white-goods" | "moving" | "services" | "placeholder";

// Card ids from lib/content/ServiceWindowContent.ts.
const DELIVERY_SERVICE_ID = "collection-pickup";
const MOVING_SERVICE_ID = "moving";
const SERVICES_SERVICE_ID = "services";

// Anything unrecognised has no dedicated flow, so it falls through to the
// generic placeholder modal.
export function serviceModalKind(serviceId: string): ServiceModalKind {
  if (serviceId === DELIVERY_SERVICE_ID) return "white-goods";
  if (serviceId === MOVING_SERVICE_ID) return "moving";
  if (serviceId === SERVICES_SERVICE_ID) return "services";
  return "placeholder";
}
