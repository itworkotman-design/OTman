import { costliestFloor } from "@/lib/booking/floorNumber";
import { validateEmailField, validatePhoneField, validateTextField } from "./websiteOrderValidation";
import { buildPickupNoteLines, buildWebsiteOrderNoteLines, buildWebsiteOrderTextFields } from "./websiteOrderNotes";
import { buildMultiPickupDescriptionLines, type ParsedExtraPickupLocation } from "./websiteExtraPickupLocations";
import {
  parseWhiteGoodsBookingDetails,
  withLiveOrderFields,
  type BookingCustomerType,
  type BookingPickupSource,
  type OrderExtraLine,
  type WhiteGoodsBookingDetails,
} from "./websiteBookingDetails";

// Admin editing of a homepage website order's details in WebsiteOrderModal:
// customer, every pickup stop (add/remove), delivery, floors/lifts, date and
// time window, and an optional driving-distance override. Turns the edited
// form into the order columns + booking details the rest of the app reads
// (the same fields app/api/site/white-goods-order/route.ts writes at
// booking), so GSM, the standard editor and re-pricing all see the change.

export type AdminPickupStop = {
  source: BookingPickupSource | null;
  placeName: string;
  address: string;
  // Counts from 1, negative for basements, null = not given. A store has none.
  floor: number | null;
  liftAvailable: boolean;
  contactName: string;
  contactPhone: string;
  // Which products this stop collects (only meaningful with several stops):
  // display names, and the product card ids they are.
  productNames: string[];
  cardIds?: number[];
};

export type AdminOrderDetails = {
  customer: {
    name: string;
    phone: string;
    email: string;
    comments: string;
    customerType: BookingCustomerType | null;
  };
  pickups: AdminPickupStop[];
  delivery: { address: string; floor: number | null; liftAvailable: boolean };
  preferredDate: string;
  timeWindow: string;
  // Km, e.g. "21.5". null = calculate the route (or keep it when no address
  // changed).
  drivingDistanceOverride: string | null;
};

export const MAX_PICKUP_STOPS = 6;

const SOURCES: BookingPickupSource[] = ["store", "private", "business"];
const CUSTOMER_TYPES: BookingCustomerType[] = ["private", "business"];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function floorOf(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const floor = Number(value);
  return Number.isInteger(floor) && floor !== 0 ? floor : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function names(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function cardIdList(value: unknown): number[] | undefined {
  return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : undefined;
}

export type ParsedAdminOrderDetails =
  | { ok: true; details: AdminOrderDetails }
  | { ok: false; reason: "INVALID_DETAILS"; errors: Record<string, string> };

export function parseAdminOrderDetails(raw: unknown): ParsedAdminOrderDetails {
  const v = record(raw);
  if (!v) return { ok: false, reason: "INVALID_DETAILS", errors: { details: "Missing details" } };
  const errors: Record<string, string> = {};

  const c = record(v.customer) ?? {};
  const customer = {
    name: text(c.name),
    phone: text(c.phone),
    email: text(c.email),
    comments: text(c.comments),
    customerType: CUSTOMER_TYPES.find((t) => t === c.customerType) ?? null,
  };
  // An admin can save anything — empty is fine; only what's filled in is
  // checked for format.
  if (validateTextField(customer.name)) errors["customer.name"] = "Contains disallowed characters";
  const phoneError = customer.phone ? validatePhoneField(customer.phone) : null;
  if (phoneError) errors["customer.phone"] = phoneError;
  const emailError = validateEmailField(customer.email);
  if (emailError) errors["customer.email"] = emailError;
  if (validateTextField(customer.comments)) errors["customer.comments"] = "Contains disallowed characters";

  const rawPickups = Array.isArray(v.pickups) ? v.pickups : [];
  if (rawPickups.length > MAX_PICKUP_STOPS) errors.pickups = `At most ${MAX_PICKUP_STOPS} pickups`;
  const pickups: AdminPickupStop[] = rawPickups.slice(0, MAX_PICKUP_STOPS).map((rawStop, i) => {
    const s = record(rawStop) ?? {};
    const source = SOURCES.find((src) => src === s.source) ?? null;
    const isStore = source === "store";
    const stop: AdminPickupStop = {
      source,
      placeName: text(s.placeName),
      address: text(s.address),
      floor: isStore ? null : floorOf(s.floor),
      liftAvailable: isStore ? false : s.liftAvailable === true,
      contactName: text(s.contactName),
      contactPhone: text(s.contactPhone),
      productNames: names(s.productNames),
    };
    const cardIds = cardIdList(s.cardIds);
    if (cardIds) stop.cardIds = cardIds;
    if (stop.contactPhone && validatePhoneField(stop.contactPhone)) errors[`pickup.${i + 1}.contactPhone`] = "Invalid phone number";
    return stop;
  });

  const d = record(v.delivery) ?? {};
  const delivery = { address: text(d.address), floor: floorOf(d.floor), liftAvailable: d.liftAvailable === true };

  let drivingDistanceOverride: string | null = null;
  const rawOverride = text(v.drivingDistanceOverride).replace(",", ".");
  if (rawOverride) {
    const km = Number(rawOverride);
    if (!Number.isFinite(km) || km < 0) errors.drivingDistanceOverride = "Must be a distance in km";
    else drivingDistanceOverride = rawOverride;
  }

  if (Object.keys(errors).length > 0) return { ok: false, reason: "INVALID_DETAILS", errors };
  return {
    ok: true,
    details: {
      customer,
      pickups,
      delivery,
      preferredDate: text(v.preferredDate),
      timeWindow: text(v.timeWindow),
      drivingDistanceOverride,
    },
  };
}

// Whether the route (and so the driving distance) changed: any stop's
// address, or the number of stops.
export function routeAddressesChanged(
  stored: { pickupAddress: string | null; extraPickupAddress: string[]; deliveryAddress: string | null },
  details: AdminOrderDetails,
): boolean {
  const before = [stored.pickupAddress ?? "", ...stored.extraPickupAddress, stored.deliveryAddress ?? ""].map((a) => a.trim());
  const after = [...details.pickups.map((p) => p.address), details.delivery.address];
  return before.length !== after.length || before.some((address, i) => address !== after[i]);
}

function toBookingDetails(
  details: AdminOrderDetails,
  drivingDistance: string,
  orderExtras: OrderExtraLine[],
): WhiteGoodsBookingDetails {
  return {
    version: 1,
    customerType: details.customer.customerType,
    pickups: details.pickups.map((stop) => ({
      source: stop.source,
      placeName: stop.placeName,
      address: stop.address,
      floor: stop.floor,
      liftAvailable: stop.liftAvailable,
      contactName: stop.contactName,
      contactPhone: stop.contactPhone,
      ...(stop.productNames.length > 0 ? { productNames: stop.productNames } : {}),
      ...(stop.cardIds ? { cardIds: stop.cardIds } : {}),
    })),
    delivery: { ...details.delivery },
    preferredDate: details.preferredDate,
    timeWindow: details.timeWindow,
    drivingDistance,
    orderExtras,
  };
}

// Old-format labels (legacyGeneratedNotes only).
const SOURCE_LABELS: Record<BookingPickupSource, string> = {
  store: "Store",
  private: "Private individual",
  business: "Business",
};

// The floor/lift pair the order stores (and GSM prints) — see the booking route.
function orderFloorPair(details: WhiteGoodsBookingDetails) {
  const [first] = details.pickups;
  const isStorePickup = first?.source === "store";
  const pickupFloor = isStorePickup ? 0 : (first?.floor ?? 0);
  const pickupLiftAvailable = isStorePickup ? true : (first?.liftAvailable ?? false);
  const deliveryFloor = details.delivery.floor ?? 0;
  return {
    isStorePickup,
    pickupFloor,
    pickupLiftAvailable,
    deliveryFloor,
    orderFloorNo: String(costliestFloor(pickupFloor, deliveryFloor)),
    orderLift: (pickupLiftAvailable && details.delivery.liftAvailable ? "yes" : "no") as "yes" | "no",
  };
}

// The pickup notes the booking route writes into the description
// (buildPickupNoteLines), for these booking details.
function generatedNotes(details: WhiteGoodsBookingDetails): string | null {
  if (details.pickups.length === 0) return null;
  const pair = orderFloorPair(details);
  const noteLines = buildPickupNoteLines({
    stops: details.pickups.map((stop) => ({
      source: stop.source,
      placeName: stop.placeName || null,
      address: stop.address || null,
      floor: stop.floor ?? 0,
      liftAvailable: stop.liftAvailable,
      contactName: stop.contactName || null,
      contactPhone: stop.contactPhone || null,
      productNames: stop.productNames ?? [],
    })),
    deliveryFloor: pair.deliveryFloor,
    deliveryLiftAvailable: details.delivery.liftAvailable,
    orderFloorNo: pair.orderFloorNo,
    orderLift: pair.orderLift,
  });
  return buildWebsiteOrderTextFields({ customerComment: null, noteLines, multiPickupLines: [] }).description;
}

// The notes older orders were booked with (before buildPickupNoteLines) —
// only to find and replace them on those orders.
function legacyGeneratedNotes(details: WhiteGoodsBookingDetails): string | null {
  const [first, ...extras] = details.pickups;
  if (!first) return null;
  const pair = orderFloorPair(details);
  const noteLines = buildWebsiteOrderNoteLines({
    pickupSourceLabel: first.source ? SOURCE_LABELS[first.source] : null,
    pickupPlaceName: first.placeName || null,
    pickupContactName: first.contactName || null,
    pickupContactPhone: first.contactPhone || null,
    isStorePickup: pair.isStorePickup,
    pickupFloor: pair.pickupFloor,
    pickupLiftAvailable: pair.pickupLiftAvailable,
    deliveryFloor: pair.deliveryFloor,
    deliveryLiftAvailable: details.delivery.liftAvailable,
    orderFloorNo: pair.orderFloorNo,
    orderLift: pair.orderLift,
  });
  const extraLocations: ParsedExtraPickupLocation[] = extras.map((stop) => ({
    source: stop.source,
    placeName: stop.placeName || null,
    address: stop.address || null,
    floor: stop.floor ?? 0,
    liftAvailable: stop.liftAvailable,
    contactName: stop.contactName || null,
    contactPhone: stop.contactPhone || null,
    productNames: stop.productNames ?? [],
  }));
  const multiPickupLines = buildMultiPickupDescriptionLines({
    firstLocationAddress: first.address || null,
    firstLocationProductNames: first.productNames ?? [],
    extraLocations,
  });
  return buildWebsiteOrderTextFields({ customerComment: null, noteLines, multiPickupLines }).description;
}

// The new description: the previously generated notes swapped for new ones,
// keeping anything staff wrote around them. If the old notes can't be found
// (already hand-edited), the new ones are added at the end.
function nextDescription(stored: string | null, oldNotes: (string | null)[], newNotes: string | null): string | null {
  const current = stored?.trim() ? stored : "";
  if (!current) return newNotes;
  const found = oldNotes.find((notes): notes is string => !!notes && current.includes(notes));
  if (found) {
    return current.replace(found, newNotes ?? "").trim() || null;
  }
  if (!newNotes || current.includes(newNotes)) return current;
  return `${current}\n\n${newNotes}`;
}

export function buildDetailsUpdate(params: {
  details: AdminOrderDetails;
  drivingDistance: string;
  // The order's current booking details (for the booked order extras until
  // re-pricing replaces them, and to find the old generated notes).
  storedBookingDetails: unknown;
  storedDescription: string | null;
}) {
  const { details, drivingDistance } = params;
  const stored = parseWhiteGoodsBookingDetails(params.storedBookingDetails);
  const storedExtras = record(params.storedBookingDetails)?.orderExtras;
  const orderExtras = stored?.orderExtras ?? (Array.isArray(storedExtras) ? (storedExtras as OrderExtraLine[]) : []);
  const bookingDetails = toBookingDetails(details, drivingDistance, orderExtras);

  const [first, ...extras] = details.pickups;
  const isStorePickup = first?.source === "store";
  const pickupFloor = isStorePickup ? 0 : (first?.floor ?? 0);
  const pickupLift = isStorePickup ? true : (first?.liftAvailable ?? false);
  const deliveryFloor = details.delivery.floor ?? 0;

  return {
    bookingDetails,
    orderData: {
      customerName: details.customer.name,
      phone: details.customer.phone,
      email: details.customer.email || null,
      customerComments: details.customer.comments || null,
      description: nextDescription(
        params.storedDescription,
        // Current format first, then the one older orders were booked with.
        stored ? [generatedNotes(stored), legacyGeneratedNotes(stored)] : [],
        generatedNotes(bookingDetails),
      ),
      pickupAddress: first?.address ?? null,
      extraPickupAddress: extras.map((stop) => stop.address),
      deliveryAddress: details.delivery.address,
      deliveryDate: details.preferredDate || null,
      timeWindow: details.timeWindow || null,
      drivingDistance: drivingDistance || null,
      // The one combined floor/lift pair (see the booking route).
      floorNo: String(costliestFloor(pickupFloor, deliveryFloor)),
      lift: pickupLift && details.delivery.liftAvailable ? "yes" : "no",
    },
  };
}

// The edit form's starting values, from the order as it is now.
export function editableDetailsFromOrder(order: {
  customerName: string | null;
  phone: string | null;
  email: string | null;
  customerComments: string | null;
  pickupAddress: string | null;
  extraPickupAddress: string[];
  deliveryAddress: string | null;
  deliveryDate: string | null;
  timeWindow: string | null;
  drivingDistance: string | null;
  websiteBookingDetails: unknown;
}): AdminOrderDetails | null {
  const booked = parseWhiteGoodsBookingDetails(order.websiteBookingDetails);
  if (!booked) return null;
  const details = withLiveOrderFields(booked, order);
  return {
    customer: {
      name: order.customerName ?? "",
      phone: order.phone ?? "",
      email: order.email ?? "",
      comments: order.customerComments ?? "",
      customerType: details.customerType,
    },
    pickups: details.pickups.map((stop) => ({
      source: stop.source,
      placeName: stop.placeName,
      address: stop.address,
      floor: stop.floor,
      liftAvailable: stop.liftAvailable,
      contactName: stop.contactName,
      contactPhone: stop.contactPhone,
      productNames: stop.productNames ?? [],
      ...(stop.cardIds ? { cardIds: stop.cardIds } : {}),
    })),
    delivery: { ...details.delivery },
    preferredDate: details.preferredDate,
    timeWindow: details.timeWindow,
    drivingDistanceOverride: null,
  };
}
