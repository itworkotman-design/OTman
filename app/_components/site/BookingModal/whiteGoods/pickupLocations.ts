import { isPickupContactStepReady } from "./PickupContactCard";
import type { PickupSource } from "./PickupSourceStep";

// One pickup stop beyond the first (which stays backed by
// WhiteGoodsBookingFlow's own top-level pickupSource/pickupAddress/etc.
// state, unchanged, for backward compatibility). Reached only when the
// customer says not everything is picked up from one place.
export type PickupLocationState = {
  id: number;
  source: PickupSource | null;
  placeName: string;
  address: string;
  addressSelected: boolean;
  floor: number;
  liftAvailable: boolean;
  contactName: string;
  contactPhone: string;
  // Claims every card still unassigned by an earlier location, skipping the
  // checklist below. Irrelevant (and never asked) once the pool offered to
  // this location is down to one card — there's nothing left to choose
  // between.
  allRemainingHere: boolean;
  // Assignment is per product CARD, not per product — a product split into
  // several independently-configured cards (see productQuantity.ts's
  // addAnotherProductCard) can have its units picked up from different
  // locations, same as the order summary shows them as separate "#1"/"#2"
  // entries.
  selectedCardIds: number[];
};

export function createPickupLocation(id: number): PickupLocationState {
  return {
    id,
    source: null,
    placeName: "",
    address: "",
    addressSelected: false,
    floor: 0,
    liftAvailable: false,
    contactName: "",
    contactPhone: "",
    // Defaults to "everything else is here", the same assumption the first
    // location's own checkbox starts with — most orders only ever need a
    // second pickup point, so this is usually the last question asked.
    allRemainingHere: true,
    selectedCardIds: [],
  };
}

export function nextPickupLocationId(locations: PickupLocationState[]): number {
  return locations.reduce((max, loc) => Math.max(max, loc.id), -1) + 1;
}

// Every card on the order that has a product, in cart order — the pool a
// pickup location's checklist offers. One entry per card (not deduped by
// product), so a product split into several cards shows up as several
// separately-assignable items.
export function orderedCardIds(cards: { cardId: number; productId: string | null }[]): number[] {
  return cards.filter((card) => card.productId).map((card) => card.cardId);
}

// What a location actually claims from the pool it's offered: everything,
// if there's nothing to choose between (one card left) or "all here" was
// checked; otherwise whatever was explicitly ticked (filtered against the
// pool, in case a card was removed from the order after being selected).
export function claimedCardIds(pool: number[], allHere: boolean, selectedCardIds: number[]): number[] {
  if (pool.length <= 1 || allHere) return pool;
  return selectedCardIds.filter((id) => pool.includes(id));
}

export function remainingAfterClaim(pool: number[], claimed: number[]): number[] {
  return pool.filter((id) => !claimed.includes(id));
}

// Whether one location's own required fields, plus (if it was actually
// offered a choice) its card selection, are filled in.
export function isPickupLocationReady(location: PickupLocationState, pool: number[]): boolean {
  const fieldsReady = isPickupContactStepReady({
    pickupSource: location.source,
    pickupPlaceName: location.placeName,
    pickupAddress: location.address,
    pickupAddressSelected: location.addressSelected,
    pickupContactName: location.contactName,
    pickupContactPhone: location.contactPhone,
  });
  const selectionReady = pool.length <= 1 || location.allRemainingHere || location.selectedCardIds.length > 0;
  return fieldsReady && selectionReady;
}

// Grows or trims the list of extra pickup locations (beyond the fixed
// first one) to match how many are actually needed right now: one more the
// moment the existing chain resolves down to something still unclaimed,
// none once everything is claimed. Stops looking past the first location
// that hasn't made a claim yet — that one is still being filled in, so
// there's nothing beyond it to grow into yet. Existing entries are kept by
// reference so their typed-in fields survive re-syncing.
export function syncPickupLocations(
  locations: PickupLocationState[],
  firstLocationRemaining: number[],
  nextId: () => number,
): PickupLocationState[] {
  const next: PickupLocationState[] = [];
  let pool = firstLocationRemaining;
  let awaitingClaim = false;
  for (const location of locations) {
    if (pool.length === 0) break;
    next.push(location);
    const claimed = claimedCardIds(pool, location.allRemainingHere, location.selectedCardIds);
    if (claimed.length === 0) {
      awaitingClaim = true;
      break;
    }
    pool = remainingAfterClaim(pool, claimed);
  }
  if (!awaitingClaim && pool.length > 0) next.push(createPickupLocation(nextId()));
  return next;
}

// The pool offered to each location in turn (for rendering their
// checklists), and whatever's left once the last one has claimed its share
// — non-empty only while pickup assignment isn't finished yet.
export function poolsForLocations(
  locations: PickupLocationState[],
  firstLocationRemaining: number[],
): { pools: number[][]; finalRemaining: number[] } {
  const pools: number[][] = [];
  let pool = firstLocationRemaining;
  for (const location of locations) {
    pools.push(pool);
    const claimed = claimedCardIds(pool, location.allRemainingHere, location.selectedCardIds);
    pool = remainingAfterClaim(pool, claimed);
  }
  return { pools, finalRemaining: pool };
}

// The stops the driving distance is routed through: pickup 1, then every
// extra pickup location in order, then delivery (see
// /api/site/route-distance). Null until every one of those addresses was
// actually picked from the suggestions — a half-filled extra pickup would
// otherwise quietly show the shorter route without it.
export function routeStopsForDistance(params: {
  pickupAddress: string;
  pickupAddressSelected: boolean;
  extraLocations: PickupLocationState[];
  deliveryAddress: string;
  deliveryAddressSelected: boolean;
}): { pickupAddress: string; extraPickupAddresses: string[]; deliveryAddress: string } | null {
  const pickupAddress = params.pickupAddress.trim();
  const deliveryAddress = params.deliveryAddress.trim();
  if (!pickupAddress || !params.pickupAddressSelected) return null;
  if (!deliveryAddress || !params.deliveryAddressSelected) return null;
  if (params.extraLocations.some((loc) => !loc.address.trim() || !loc.addressSelected)) return null;
  return {
    pickupAddress,
    extraPickupAddresses: params.extraLocations.map((loc) => loc.address.trim()),
    deliveryAddress,
  };
}

// Splits an ordered list into sections by category, in first-seen category
// order (an item under a category already seen joins that section, even if
// another category appeared in between) — used to group a pickup
// location's product checklist by price-list category once the order spans
// more than one.
export function groupByCategory<T>(items: T[], categoryOf: (item: T) => string): { category: string; items: T[] }[] {
  const order: string[] = [];
  const byCategory = new Map<string, T[]>();
  for (const item of items) {
    const category = categoryOf(item);
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
      order.push(category);
    }
    byCategory.get(category)!.push(item);
  }
  return order.map((category) => ({ category, items: byCategory.get(category)! }));
}

// Whether the order-details/contact steps have anything in them worth
// protecting from disappearing — see WhiteGoodsBookingFlow's pickup-contact
// AutoAdvance: toggling "all products picked up here" after these were
// already filled in must not retract them, but toggling it before either is
// reached (or while both are still blank) is free to.
export function hasEnteredOrderOrContactDetails(fields: {
  deliveryAddress: string;
  preferredDate: string;
  timeWindow: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
}): boolean {
  return Object.values(fields).some((value) => value.trim().length > 0);
}
