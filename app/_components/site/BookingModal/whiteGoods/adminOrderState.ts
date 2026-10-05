import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { AdminOrderDetails, AdminPickupStop } from "@/lib/orders/websiteOrderDetailsEdit";
import type { BookingCustomerType } from "@/lib/orders/websiteBookingDetails";
import { createPickupLocation, orderedCardIds, type PickupLocationState } from "./pickupLocations";
import type { PickupSource } from "./PickupSourceStep";

// The booking flow (WhiteGoodsBookingFlow) doubles as the admin editor for an
// existing website order. These two convert between the order as stored
// (AdminOrderDetails from GET /api/orders/[orderId]/website-items) and the
// flow's own pickup state, and back into the save payload.

// "Vaskemaskin #2 (×2)" → "Vaskemaskin #2": the quantity suffix the pickup
// checklist adds isn't part of a product's name.
function baseName(name: string) {
  return name.replace(/\s*\(×\d+\)\s*$/, "").trim();
}

// Which product cards each stored stop collects: by card id (newer orders),
// else by the product names stored at booking.
function claimsPerStop(cards: SavedProductCard[], stops: AdminPickupStop[], nameOf: (cardId: number) => string) {
  const pool = orderedCardIds(cards);
  const claimed = new Set<number>();
  return stops.map((stop) => {
    const ids = stop.cardIds
      ? stop.cardIds.filter((id) => pool.includes(id) && !claimed.has(id))
      : pool.filter(
          (id) => !claimed.has(id) && stop.productNames.some((name) => baseName(name) === baseName(nameOf(id))),
        );
    ids.forEach((id) => claimed.add(id));
    return ids;
  });
}

// The flow's pickup state for an order's stops: the first stop stays the
// flow's own top-level fields; every later stop becomes an extra pickup
// location, the last one taking whatever is still unassigned.
export function pickupStateFromStops(params: {
  cards: SavedProductCard[];
  stops: AdminPickupStop[];
  nameOf: (cardId: number) => string;
}): { allProductsPickedUpHere: boolean; pickupCardIds: number[]; extraLocations: PickupLocationState[] } {
  const { cards, stops, nameOf } = params;
  if (stops.length <= 1) return { allProductsPickedUpHere: true, pickupCardIds: [], extraLocations: [] };

  const claims = claimsPerStop(cards, stops, nameOf);
  const extraLocations = stops.slice(1).map((stop, i, extras) => ({
    ...createPickupLocation(i),
    source: stop.source,
    placeName: stop.placeName,
    address: stop.address,
    // Already a confirmed address — counts as picked from the suggestions.
    addressSelected: !!stop.address,
    floor: stop.floor,
    liftAvailable: stop.liftAvailable,
    contactName: stop.contactName,
    contactPhone: stop.contactPhone,
    allRemainingHere: i === extras.length - 1,
    selectedCardIds: claims[i + 1] ?? [],
  }));
  return { allProductsPickedUpHere: false, pickupCardIds: claims[0] ?? [], extraLocations };
}

type FlowStop = {
  source: PickupSource | null;
  placeName: string;
  address: string;
  floor: number | null;
  liftAvailable: boolean;
  contactName: string;
  contactPhone: string;
  cardIds: number[];
  productNames: string[];
};

function toAdminStop(stop: FlowStop): AdminPickupStop {
  return {
    source: stop.source,
    placeName: stop.placeName,
    address: stop.address,
    floor: stop.floor,
    liftAvailable: stop.liftAvailable,
    contactName: stop.contactName,
    contactPhone: stop.contactPhone,
    productNames: stop.productNames,
    cardIds: stop.cardIds,
  };
}

// The admin save payload for PUT /api/orders/[orderId]/website-items. The
// distance the editor priced with is sent along, so the order is saved at
// exactly the price shown.
export function adminDetailsFromFlow(state: {
  customerType: BookingCustomerType | null;
  name: string;
  phone: string;
  email: string;
  notes: string;
  firstPickup: FlowStop;
  extraPickups: FlowStop[];
  delivery: { address: string; floor: number | null; liftAvailable: boolean };
  preferredDate: string;
  timeWindow: string;
  drivingDistance: string;
}): AdminOrderDetails {
  return {
    customer: {
      name: state.name,
      phone: state.phone,
      email: state.email,
      comments: state.notes,
      customerType: state.customerType,
    },
    pickups: [toAdminStop(state.firstPickup), ...state.extraPickups.map(toAdminStop)],
    delivery: { ...state.delivery },
    preferredDate: state.preferredDate,
    timeWindow: state.timeWindow,
    drivingDistanceOverride: state.drivingDistance.trim() ? state.drivingDistance : null,
  };
}
