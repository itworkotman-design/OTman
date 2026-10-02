import type { ParsedExtraPickupLocation } from "./websiteExtraPickupLocations";

// What the customer entered in the homepage white-goods flow, stored as-is on
// Order.websiteBookingDetails so the admin WebsiteOrderModal can show every
// pickup stop, the delivery and the customer type. The regular order columns
// can't hold this: Order.floorNo/lift are one combined pair, and the extra
// pickup stops otherwise only exist as free text in the description.
// Versioned so the shape can change later without misreading old rows.

export type BookingPickupSource = "store" | "private" | "business";
export type BookingCustomerType = "private" | "business";

// One pickup stop. Same shape the homepage review page renders (orderReview.ts's
// ReviewPickup), so both read through buildOrderReviewBlocks.
export type BookingPickupStop = {
  source: BookingPickupSource | null;
  placeName: string;
  address: string;
  // Counts from 1 (ground floor), negative for basements; null when not
  // asked (store) or not given.
  floor: number | null;
  liftAvailable: boolean;
  contactName: string;
  contactPhone: string;
  // Only once the order is split across locations — which products this stop
  // collects.
  productNames?: string[];
};

export type WhiteGoodsBookingDetails = {
  version: 1;
  customerType: BookingCustomerType | null;
  pickups: BookingPickupStop[];
  delivery: { address: string; floor: number | null; liftAvailable: boolean };
  preferredDate: string;
  timeWindow: string;
  drivingDistance: string;
  // Charges not tied to a product card (floor surcharge, extra pickups,
  // distance…) as priced at booking — the pricing snapshot only keeps
  // product lines. Same lines the homepage summary shows under order extras.
  orderExtras: OrderExtraLine[];
};

export type OrderExtraLine = { label: string; price: number; qty: number };

export type WhiteGoodsBookingDetailsInput = {
  customerType: unknown;
  firstPickup: {
    source: unknown;
    placeName: string | null;
    address: string | null;
    floor: number;
    liftAvailable: boolean;
    contactName: string | null;
    contactPhone: string | null;
    productNames: string[];
  };
  extraPickups: ParsedExtraPickupLocation[];
  delivery: { address: string | null; floor: number; liftAvailable: boolean };
  preferredDate: string | null;
  timeWindow: string | null;
  drivingDistance: string | null;
  orderExtras: OrderExtraLine[];
};

const PICKUP_SOURCES: BookingPickupSource[] = ["store", "private", "business"];
const CUSTOMER_TYPES: BookingCustomerType[] = ["private", "business"];

function pickupSource(value: unknown): BookingPickupSource | null {
  return PICKUP_SOURCES.find((source) => source === value) ?? null;
}

function customerType(value: unknown): BookingCustomerType | null {
  return CUSTOMER_TYPES.find((type) => type === value) ?? null;
}

// 0 means "not given" in the order route (see parseFloorNumber).
function floorOrNull(floor: unknown): number | null {
  return typeof floor === "number" && Number.isInteger(floor) && floor !== 0 ? floor : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function names(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((name): name is string => typeof name === "string" && name.trim() !== "") : [];
}

function stop(fields: {
  source: unknown;
  placeName: unknown;
  address: unknown;
  floor: unknown;
  liftAvailable: unknown;
  contactName: unknown;
  contactPhone: unknown;
  productNames: unknown;
}): BookingPickupStop {
  const source = pickupSource(fields.source);
  // A store is never asked for a floor/lift (see the order route).
  const isStore = source === "store";
  const productNames = names(fields.productNames);
  return {
    source,
    placeName: text(fields.placeName),
    address: text(fields.address),
    floor: isStore ? null : floorOrNull(fields.floor),
    liftAvailable: isStore ? false : fields.liftAvailable === true,
    contactName: text(fields.contactName),
    contactPhone: text(fields.contactPhone),
    ...(productNames.length > 0 ? { productNames } : {}),
  };
}

export function buildWhiteGoodsBookingDetails(input: WhiteGoodsBookingDetailsInput): WhiteGoodsBookingDetails {
  return {
    version: 1,
    customerType: customerType(input.customerType),
    pickups: [stop(input.firstPickup), ...input.extraPickups.map((loc) => stop(loc))],
    delivery: {
      address: text(input.delivery.address),
      floor: floorOrNull(input.delivery.floor),
      liftAvailable: input.delivery.liftAvailable,
    },
    preferredDate: text(input.preferredDate),
    timeWindow: text(input.timeWindow),
    drivingDistance: text(input.drivingDistance),
    orderExtras: input.orderExtras.map((line) => ({ label: line.label, price: line.price, qty: line.qty })),
  };
}

// Reads Order.websiteBookingDetails back. Never throws: null for anything that
// isn't version-1 details (the caller then falls back to the regular order
// modal), and malformed fields inside a stop coerced to safe defaults.
export function parseWhiteGoodsBookingDetails(value: unknown): WhiteGoodsBookingDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || !Array.isArray(v.pickups)) return null;
  if (!v.delivery || typeof v.delivery !== "object" || Array.isArray(v.delivery)) return null;
  const delivery = v.delivery as Record<string, unknown>;

  return {
    version: 1,
    customerType: customerType(v.customerType),
    pickups: v.pickups
      .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object" && !Array.isArray(raw))
      .map((raw) => stop(raw as Parameters<typeof stop>[0])),
    delivery: {
      address: text(delivery.address),
      floor: floorOrNull(delivery.floor),
      liftAvailable: delivery.liftAvailable === true,
    },
    preferredDate: text(v.preferredDate),
    timeWindow: text(v.timeWindow),
    drivingDistance: text(v.drivingDistance),
    orderExtras: Array.isArray(v.orderExtras)
      ? v.orderExtras.filter(isOrderExtraLine).map((line) => ({ label: line.label, price: line.price, qty: line.qty }))
      : [],
  };
}

function isOrderExtraLine(value: unknown): value is OrderExtraLine {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.label === "string" &&
    typeof line.price === "number" &&
    Number.isFinite(line.price) &&
    typeof line.qty === "number" &&
    Number.isFinite(line.qty)
  );
}
