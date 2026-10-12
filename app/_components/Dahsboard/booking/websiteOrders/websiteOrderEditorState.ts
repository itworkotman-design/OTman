import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { AdminPickupStop } from "@/lib/orders/websiteOrderDetailsEdit";
import { findCardsWithoutPickup, findPickupsWithoutProducts } from "@/lib/orders/pickupAssignment";
import { findCardsWithSizeBracketProblems, findSizePricedCardsMissingName } from "@/lib/booking/pricing/sizeBrackets";
import { findInstallOnlyCardsMissingInstall } from "@/lib/booking/installOnlyRequirement";
import { claimsPerStop } from "@/app/_components/site/BookingModal/whiteGoods/adminOrderState";
import { orderedCardIds } from "@/app/_components/site/BookingModal/whiteGoods/pickupLocations";
import {
  addAnotherProductCard,
  applyProductQuantity,
  nextCardId,
  removeProductCard,
} from "@/app/_components/site/BookingModal/whiteGoods/productQuantity";

// The admin "Edit order" tab's products and pickup stops (WebsiteOrderEditTab).
// Every stop keeps the card ids it collects; with a single stop that's simply
// every product. Same rules as the customer's booking flow: once the order is
// split, each product is on exactly one stop (findCardsWithoutPickup).

export type EditorStop = Omit<AdminPickupStop, "cardIds" | "productNames"> & { cardIds: number[] };

function emptyStop(): EditorStop {
  return {
    source: null,
    placeName: "",
    address: "",
    floor: null,
    liftAvailable: false,
    contactName: "",
    contactPhone: "",
    cardIds: [],
  };
}

// A lone stop collects everything — kept explicit so the save sends it.
function withSingleStopClaimingAll(stops: EditorStop[], cards: SavedProductCard[]): EditorStop[] {
  return stops.length === 1 ? [{ ...stops[0], cardIds: orderedCardIds(cards) }] : stops;
}

export function stopsFromDetails(
  stops: AdminPickupStop[],
  cards: SavedProductCard[],
  nameOf: (cardId: number) => string,
): EditorStop[] {
  if (stops.length === 0) return [{ ...emptyStop(), cardIds: orderedCardIds(cards) }];
  // By card id on newer orders, by the stored product names on older ones.
  const claims = claimsPerStop(cards, stops, nameOf);
  const editorStops = stops.map(
    (stop, i): EditorStop => ({
      source: stop.source,
      placeName: stop.placeName,
      address: stop.address,
      floor: stop.floor,
      liftAvailable: stop.liftAvailable,
      contactName: stop.contactName,
      contactPhone: stop.contactPhone,
      cardIds: claims[i] ?? [],
    }),
  );
  return withSingleStopClaimingAll(editorStops, cards);
}

// A product is collected at one stop only: ticking it here takes it off the others.
export function toggleCardOnStop(stops: EditorStop[], stopIndex: number, cardId: number, on: boolean): EditorStop[] {
  return stops.map((stop, i) => {
    const without = stop.cardIds.filter((id) => id !== cardId);
    return { ...stop, cardIds: i === stopIndex && on ? [...without, cardId] : without };
  });
}

// A product already on the order gets another, separately configured card
// next to its others (same as the customer's "add another").
export function addProductToOrder(
  cards: SavedProductCard[],
  stops: EditorStop[],
  productId: string,
): { cards: SavedProductCard[]; stops: EditorStop[] } {
  const id = nextCardId(cards);
  const nextCards = cards.some((card) => card.productId === productId)
    ? addAnotherProductCard(cards, productId, id)
    : applyProductQuantity(cards, productId, 1, id);
  return { cards: nextCards, stops: withSingleStopClaimingAll(stops, nextCards) };
}

export function removeCardFromOrder(
  cards: SavedProductCard[],
  stops: EditorStop[],
  cardId: number,
): { cards: SavedProductCard[]; stops: EditorStop[] } {
  return {
    cards: removeProductCard(cards, cardId),
    stops: stops.map((stop) => ({ ...stop, cardIds: stop.cardIds.filter((id) => id !== cardId) })),
  };
}

export function addStop(stops: EditorStop[]): EditorStop[] {
  return [...stops, emptyStop()];
}

// Its products are left unassigned (or, down to one stop, all go to that one).
export function removeStop(stops: EditorStop[], cards: SavedProductCard[], stopIndex: number): EditorStop[] {
  if (stops.length <= 1) return stops;
  return withSingleStopClaimingAll(
    stops.filter((_, i) => i !== stopIndex),
    cards,
  );
}

// Which fields a stop asks for, by who it's picked up from — same as the
// customer's PickupContactCard. A stop without a type (older orders) shows all.
export function pickupFieldsFor(source: EditorStop["source"]): { placeName: boolean; contactPerson: boolean; floor: boolean } {
  return {
    placeName: source !== "private",
    contactPerson: source !== "store",
    floor: source !== "store",
  };
}

// A store stop has no contact person (hidden fields can still hold one typed
// before the type was switched to store).
export function stopsForSave(stops: EditorStop[], nameOf: (cardId: number) => string): AdminPickupStop[] {
  return stops.map((stop) => ({
    ...stop,
    ...(stop.source === "store" ? { contactName: "", contactPhone: "" } : {}),
    productNames: stop.cardIds.map(nameOf),
  }));
}

// Pickup stops (by index) that collect no products — a sign the products
// weren't split across the addresses yet. A lone stop collects everything.
export function stopsWithoutProducts(stops: EditorStop[]): number[] {
  return findPickupsWithoutProducts(stops);
}

export type EditorBlocker =
  | "PRODUCT_WITHOUT_PICKUP"
  | "PICKUP_WITHOUT_PRODUCT"
  | "SIZE_BRACKETS_REQUIRED"
  | "ITEM_NAME_REQUIRED"
  | "INSTALL_OPTION_REQUIRED"
  // Added by WebsiteOrderEditTab itself: "Custom time" chosen without a valid from/to.
  | "TIME_WINDOW_INCOMPLETE";

// What keeps Save disabled — the customer flow's own completeness rules.
export function editorBlockers(cards: SavedProductCard[], stops: EditorStop[], catalogProducts: CatalogProduct[]): EditorBlocker[] {
  const blockers: EditorBlocker[] = [];
  if (findCardsWithoutPickup(stops, cards).length > 0) blockers.push("PRODUCT_WITHOUT_PICKUP");
  if (stopsWithoutProducts(stops).length > 0) blockers.push("PICKUP_WITHOUT_PRODUCT");
  if (findCardsWithSizeBracketProblems(cards, catalogProducts).length > 0) blockers.push("SIZE_BRACKETS_REQUIRED");
  if (findSizePricedCardsMissingName(cards, catalogProducts).length > 0) blockers.push("ITEM_NAME_REQUIRED");
  if (findInstallOnlyCardsMissingInstall(cards, catalogProducts).length > 0) blockers.push("INSTALL_OPTION_REQUIRED");
  return blockers;
}
