import type { MovingCatalog } from "@/lib/content/getMovingCatalog";
import { movingPriceChanges } from "./movingOrderCalculator";
import { movingEditFromOrder, parseMovingEdit } from "./movingOrderEdit";
import { movingOrderItemRows, priceMovingOrder } from "./movingOrderQuote";
import type { MovingOrderItem } from "./movingOrderView";

// A booked move priced at today's moving catalog with its own stored answers
// and distance — what "Use new price" would change it to (website-details
// lists the difference, moving-details refuses an edit until it's chosen).

type StoredMove = {
  pickupAddress: string | null;
  deliveryAddress: string | null;
  websiteBookingDetails: unknown;
  drivingDistance: string | null;
  items: MovingOrderItem[];
};

// Its lines at today's prices, or null when its answers can't be priced.
export function movingCurrentPriceRows(catalog: MovingCatalog, order: StoredMove) {
  const parsed = parseMovingEdit(movingEditFromOrder(order));
  if (!parsed.ok) return null;
  const quote = priceMovingOrder(catalog, {
    origin: parsed.origin,
    destination: parsed.destination,
    serviceCodes: parsed.edit.serviceCodes,
    drivingDistance: order.drivingDistance ?? "",
  });
  return quote.ok ? movingOrderItemRows(quote) : null;
}

// Whether any line (customer or partner) is priced differently today.
export function movingPricesOutdated(catalog: MovingCatalog, order: StoredMove): boolean {
  const current = movingCurrentPriceRows(catalog, order);
  return !!current && movingPriceChanges(order.items, current, { includePartner: true }).length > 0;
}
