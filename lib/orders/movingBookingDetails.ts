import type { BookingCustomerType } from "./websiteBookingDetails";
import { parseMovingProperty, type MovingProperty, type MovingPropertyDraft } from "./movingProperty";

// What the customer answered for a homepage move, kept on the order
// (Order.websiteBookingDetails, websiteOrderKind = MOVING_ORDER_KIND) so the
// admin WebsiteOrderModal can show it as cards and edit it. The addresses,
// date, time window and driving distance live on the order's own columns
// (an edit updates those), like a white-goods order's.

export const MOVING_ORDER_KIND = "MOVING";

export type MovingBookingDetails = {
  version: 1;
  customerType: BookingCustomerType | null;
  // Both ends as the flow's draft codes — what PropertySection edits.
  origin: MovingPropertyDraft;
  destination: MovingPropertyDraft;
  serviceCodes: string[];
};

function toDraft(property: MovingProperty): MovingPropertyDraft {
  return {
    homeType: property.homeType.code,
    sizeOptionCode: property.sizeOptionCode,
    floors: property.floors,
    floorNumber: property.floorNumber,
    hasLift: property.hasLift,
    parking: property.parking.code,
  };
}

export function buildMovingBookingDetails(input: {
  customerType: BookingCustomerType | null;
  origin: MovingProperty;
  destination: MovingProperty;
  serviceCodes: string[];
}): MovingBookingDetails {
  return {
    version: 1,
    customerType: input.customerType,
    origin: toDraft(input.origin),
    destination: toDraft(input.destination),
    serviceCodes: [...input.serviceCodes],
  };
}

// The stored record, re-validated end by end (the same parser as the booking
// route) — null for anything else, e.g. a move booked before this was stored.
export function parseMovingBookingDetails(value: unknown): MovingBookingDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return null;
  const origin = parseMovingProperty(raw.origin);
  const destination = parseMovingProperty(raw.destination);
  if (!origin.ok || !destination.ok) return null;
  if (!Array.isArray(raw.serviceCodes) || !raw.serviceCodes.every((code) => typeof code === "string")) return null;
  const customerType = raw.customerType === "private" || raw.customerType === "business" ? raw.customerType : null;
  return buildMovingBookingDetails({
    customerType,
    origin: origin.property,
    destination: destination.property,
    serviceCodes: raw.serviceCodes as string[],
  });
}
