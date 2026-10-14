import type { Prisma } from "@prisma/client";
import type { CustomerEditKind } from "./customerOrderEditPolicy";
import { buildMovingBookingDetails, parseMovingBookingDetails } from "./movingBookingDetails";
import { movingOrderDescription } from "./movingOrderDescription";
import { movingOrderItemRows, type MovingQuote } from "./movingOrderQuote";
import { parseMovingProperty, type MovingProperty, type MovingPropertyDraft } from "./movingProperty";
import type { BookingCustomerType } from "./websiteBookingDetails";
import { validateTextField } from "./websiteOrderValidation";

// Changing a booked move — shared by the admin edit
// (app/api/orders/[orderId]/moving-details) and the customer's own "My order"
// (app/api/customer/orders/[orderNumber]): what the move is, as an editable
// whole; how a change is classified (the same change kinds as a delivery
// order, so the same 24h policy applies — customerOrderEditPolicy.ts); and
// what a save writes, re-priced from the moving catalog (priceMovingOrder).

export type MovingEdit = {
  pickupAddress: string;
  deliveryAddress: string;
  origin: MovingPropertyDraft;
  destination: MovingPropertyDraft;
  serviceCodes: string[];
};

export function movingEditFromOrder(order: {
  pickupAddress: string | null;
  deliveryAddress: string | null;
  websiteBookingDetails: unknown;
}): MovingEdit | null {
  const details = parseMovingBookingDetails(order.websiteBookingDetails);
  if (!details) return null;
  return {
    pickupAddress: order.pickupAddress ?? "",
    deliveryAddress: order.deliveryAddress ?? "",
    origin: details.origin,
    destination: details.destination,
    serviceCodes: details.serviceCodes,
  };
}

export type ParsedMovingEdit =
  | { ok: true; edit: MovingEdit; origin: MovingProperty; destination: MovingProperty }
  | { ok: false; errors: Record<string, string> };

export function parseMovingEdit(raw: unknown): ParsedMovingEdit {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const errors: Record<string, string> = {};
  const address = (field: "pickupAddress" | "deliveryAddress") => {
    const value = typeof input[field] === "string" ? (input[field] as string).trim() : "";
    if (!value) errors[field] = "Required";
    else if (validateTextField(value)) errors[field] = "Contains disallowed characters";
    return value;
  };
  const pickupAddress = address("pickupAddress");
  const deliveryAddress = address("deliveryAddress");

  const origin = parseMovingProperty(input.origin);
  const destination = parseMovingProperty(input.destination);
  for (const [end, parsed] of [["origin", origin], ["destination", destination]] as const) {
    if (!parsed.ok) for (const [field, message] of Object.entries(parsed.errors)) errors[`${end}.${field}`] = message;
  }

  const codes = input.serviceCodes;
  const serviceCodesOk =
    Array.isArray(codes) && codes.every((code) => typeof code === "string") && new Set(codes).size === codes.length;
  if (!serviceCodesOk) errors.serviceCodes = "Invalid";

  if (!origin.ok || !destination.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  const booked = buildMovingBookingDetails({
    customerType: null,
    origin: origin.property,
    destination: destination.property,
    serviceCodes: codes as string[],
  });
  return {
    ok: true,
    edit: { pickupAddress, deliveryAddress, origin: booked.origin, destination: booked.destination, serviceCodes: booked.serviceCodes },
    origin: origin.property,
    destination: destination.property,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// A move's change in a delivery order's terms: a moved address is
// "addresses"; anything about either end is "reconfigure"; services only
// added are "addOns" (the one change allowed within 24h of the job), any
// removed are "reconfigure".
export function classifyMovingEdit(before: MovingEdit, after: MovingEdit): CustomerEditKind[] {
  const kinds = new Set<CustomerEditKind>();
  if (before.pickupAddress.trim() !== after.pickupAddress.trim() || before.deliveryAddress.trim() !== after.deliveryAddress.trim()) {
    kinds.add("addresses");
  }
  if (!same(before.origin, after.origin) || !same(before.destination, after.destination)) kinds.add("reconfigure");
  const removed = before.serviceCodes.some((code) => !after.serviceCodes.includes(code));
  const added = after.serviceCodes.some((code) => !before.serviceCodes.includes(code));
  if (removed) kinds.add("reconfigure");
  else if (added) kinds.add("addOns");
  return [...kinds];
}

// Everything a save of a move writes on the order, plus its new lines.
export function movingOrderSaveData(params: {
  quote: MovingQuote;
  parsed: Extract<ParsedMovingEdit, { ok: true }>;
  drivingDistance: string;
  // The customer's notes (Order.customerComments), kept in the description.
  notes: string | null;
  customerType: BookingCustomerType | null;
}) {
  const { quote, parsed } = params;
  const bookingDetails = buildMovingBookingDetails({
    customerType: params.customerType,
    origin: parsed.origin,
    destination: parsed.destination,
    serviceCodes: quote.services.map((service) => service.code),
  });
  return {
    orderData: {
      pickupAddress: parsed.edit.pickupAddress,
      deliveryAddress: parsed.edit.deliveryAddress,
      drivingDistance: params.drivingDistance || null,
      priceExVat: quote.pricing.priceExVat,
      priceSubcontractor: quote.pricing.priceSubcontractor,
      pricingSnapshot: quote.pricing.pricingSnapshot as unknown as Prisma.InputJsonValue,
      productsSummary: quote.summary,
      description: movingOrderDescription({
        originLine: quote.originLine,
        destinationLine: quote.destinationLine,
        serviceLabels: quote.services.map((service) => service.labelEn),
        notes: params.notes,
      }),
      websiteBookingDetails: bookingDetails as unknown as Prisma.InputJsonValue,
    },
    itemRows: movingOrderItemRows(quote),
  };
}
