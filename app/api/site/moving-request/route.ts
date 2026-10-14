import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { priceMovingOrder, movingOrderItemRows, type MovingQuote } from "@/lib/orders/movingOrderQuote";
import { buildMovingBookingDetails, MOVING_ORDER_KIND, type MovingBookingDetails } from "@/lib/orders/movingBookingDetails";
import { lookUpMovingDrivingDistance } from "@/lib/orders/movingDrivingDistance";
import { movingOrderDescription } from "@/lib/orders/movingOrderDescription";
import { parseMovingProperty } from "@/lib/orders/movingProperty";
import { reserveNextManualOrderNumber } from "@/lib/orders/orderNumber";
import { createOrderCreatedEvent, buildOrderEventSnapshot } from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { reservePublicOrderNumber } from "@/lib/orders/publicOrderNumber";
import { welcomeWebsiteOrderCustomer } from "@/lib/customerAccounts/welcomeWebsiteOrderCustomer";
import { getMovingCatalog } from "@/lib/content/getMovingCatalog";
import {
  validateEmailField,
  validatePhoneField,
  validateTextField,
} from "@/lib/orders/websiteOrderValidation";

// Priced by size bracket (WEBSITE_MOVING price list — see
// lib/content/movingCatalog.ts / getMovingCatalog.ts), re-resolved server
// side from the submitted `origin.sizeOptionCode` (plus optional `serviceCodes` —
// Nedpakking/Flyttevask, flat prices on the same list) rather
// than trusting a client-sent
// price. Lands on the same Order model, same dashboard review UI, same
// approve/reject/Stripe pipeline as every other website order — no new
// status value or schema change. A staff member still reviews before
// approving (same gate as every other website order), even though the price
// is no longer a placeholder. See docs/homepage-ordering-roadmap.md §6.

// Independent from the other public order-creation routes' rate limiters by
// design — a separate flow gets its own budget rather than sharing state
// with an unrelated route module.
const _rl = { lastAt: 0, dayStr: "", dayCount: 0 };

function checkRateLimit(): "ok" | "minute" | "daily" {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (_rl.dayStr !== today) {
    _rl.dayStr = today;
    _rl.dayCount = 0;
  }
  if (now - _rl.lastAt < 60_000) return "minute";
  if (_rl.dayCount >= 20) return "daily";
  _rl.lastAt = now;
  _rl.dayCount++;
  return "ok";
}

type RequestBody = Record<string, unknown>;

function str(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return s || null;
}

class CatalogNotSeededError extends Error {
  constructor() {
    super("Moving catalog not seeded — run `npm run seed:moving-catalog`");
  }
}

async function createMovingRequest(
  body: RequestBody,
  {
    quote,
    drivingDistance,
    bookingDetails,
  }: {
    // The move priced from the catalog (priceMovingOrder).
    quote: MovingQuote;
    // Driving distance pickup → delivery as looked up here ("" if it failed).
    drivingDistance: string;
    // The customer's answers, kept for the admin modal (movingBookingDetails).
    bookingDetails: MovingBookingDetails;
  },
): Promise<{ orderId: string; displayId: number; orderNumber: string | null }> {
  const membershipId = process.env.WEBSITE_MEMBERSHIP_ID;
  if (!membershipId) throw new Error("WEBSITE_MEMBERSHIP_ID not configured");

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, companyId: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Website membership not found or inactive");
  }

  const displayId = await reserveNextManualOrderNumber(membership.companyId);
  // The random number customers see; displayId stays internal/sequential.
  const orderNumber = await reservePublicOrderNumber(prisma, membership.companyId);

  const description = movingOrderDescription({
    originLine: quote.originLine,
    destinationLine: quote.destinationLine,
    serviceLabels: quote.services.map((service) => service.labelEn),
    notes: str(body.notes),
  });
  const summary = quote.summary;
  const movingPricing = quote.pricing;
  const order = await prisma.order.create({
    data: {
      companyId: membership.companyId,
      createdByMembershipId: membership.id,
      customerMembershipId: membership.id,
      displayId,
      orderNumber,
      status: "processing",
      isWebsiteOrder: true,
      // Opens in the admin WebsiteOrderModal, with the answers as cards.
      websiteOrderKind: MOVING_ORDER_KIND,
      websiteBookingDetails: bookingDetails as unknown as Prisma.InputJsonValue,
      pickupAddress: str(body.pickupAddress),
      deliveryAddress: str(body.deliveryAddress),
      drivingDistance: drivingDistance || null,
      customerName: str(body.name),
      phone: str(body.phone),
      email: str(body.email),
      customerComments: str(body.notes),
      deliveryDate: str(body.preferredDate),
      timeWindow: str(body.timeWindow),
      description,
      // Ex. VAT, with what the customer pays (incl. VAT, whole kroner) in the snapshot.
      ...movingPricing,
      pricingSnapshot: movingPricing.pricingSnapshot as unknown as Prisma.InputJsonValue,
      productsSummary: summary,
    },
  });

  // One line per priced line: size, services, floor/carry surcharges, km.
  await prisma.orderItem.createMany({
    data: movingOrderItemRows(quote).map((row) => ({ ...row, orderId: order.id })),
  });

  await createOrderCreatedEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: { membershipId: membership.id, name: "website", email: "website", source: "USER" },
    snapshot: buildOrderEventSnapshot({
      displayId: order.displayId,
      status: order.status ?? null,
      customerName: order.customerName,
      phone: order.phone,
      email: order.email,
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
      timeWindow: order.timeWindow,
      customerComments: order.customerComments,
      description: order.description,
      priceExVat: order.priceExVat,
      priceSubcontractor: order.priceSubcontractor,
      productsSummary: order.productsSummary,
    }),
  });

  await createOrderNotification(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    type: "MANUAL_REVIEW",
    title: `WEBSITE ORDER - ${summary}`,
    message: `Moving request placed via the homepage. Customer: ${order.customerName ?? "—"}, Phone: ${order.phone ?? "—"}, Email: ${order.email ?? "—"}.`,
  });

  // Best-effort (never throws) — the order is already saved. Links the
  // customer's "My order" login and sends the order-received email.
  await welcomeWebsiteOrderCustomer(order);

  return { orderId: order.id, displayId: order.displayId, orderNumber: order.orderNumber };
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  const rl = checkRateLimit();
  if (rl === "minute") {
    return NextResponse.json({ ok: false, reason: "RATE_LIMIT_MINUTE" }, { status: 429 });
  }
  if (rl === "daily") {
    return NextResponse.json({ ok: false, reason: "RATE_LIMIT_DAILY" }, { status: 429 });
  }

  const errors: Record<string, string> = {};
  const s = (v: unknown) => String(v ?? "");

  const phoneErr = validatePhoneField(s(body.phone));
  if (phoneErr) errors.phone = phoneErr;

  // Unlike white-goods-order, email is required here: this flow only ever
  // ends with staff emailing the customer a payment link/quote, so an order
  // with no email is a dead end.
  if (!str(body.email)) {
    errors.email = "Required";
  } else {
    const emailErr = validateEmailField(s(body.email));
    if (emailErr) errors.email = emailErr;
  }

  const textFields = ["pickupAddress", "deliveryAddress", "name", "timeWindow", "notes"];
  for (const field of textFields) {
    if (field in body && !(field in errors)) {
      const err = validateTextField(s(body[field]));
      if (err) errors[field] = err;
    }
  }

  if (!str(body.pickupAddress)) errors.pickupAddress = "Required";
  if (!str(body.deliveryAddress)) errors.deliveryAddress = "Required";
  if (!str(body.name)) errors.name = "Required";
  // Both ends of the move, same questions, same parser as the flow uses.
  // Errors are keyed "origin.<field>" / "destination.<field>".
  const ends = { origin: parseMovingProperty(body.origin), destination: parseMovingProperty(body.destination) };
  for (const [end, parsed] of Object.entries(ends)) {
    if (!parsed.ok) {
      for (const [field, message] of Object.entries(parsed.errors)) errors[`${end}.${field}`] = message;
    }
  }

  if (Object.keys(errors).length > 0 || !ends.origin.ok || !ends.destination.ok) {
    return NextResponse.json({ ok: false, reason: "VALIDATION_FAILED", errors }, { status: 422 });
  }

  try {
    const catalog = await getMovingCatalog();
    if (!catalog) throw new CatalogNotSeededError();

    const input = {
      origin: ends.origin.property,
      destination: ends.destination.property,
      serviceCodes: body.serviceCodes,
    };
    // Sizes and services checked against the catalog first, so a bad request
    // never costs a Mapbox lookup.
    const checked = priceMovingOrder(catalog, { ...input, drivingDistance: "" });
    if (!checked.ok) {
      return NextResponse.json({ ok: false, reason: "VALIDATION_FAILED", errors: checked.errors }, { status: 422 });
    }

    // The km charge comes from the distance looked up here, never from the
    // client. A failed lookup charges no km (logged) — staff review every
    // website order before approving it anyway.
    const drivingDistance = await lookUpMovingDrivingDistance(s(body.pickupAddress), s(body.deliveryAddress));
    const quote = priceMovingOrder(catalog, { ...input, drivingDistance });
    if (!quote.ok) throw new Error("Moving order re-pricing failed after validation");

    const customerType = body.customerType === "private" || body.customerType === "business" ? body.customerType : null;
    const bookingDetails = buildMovingBookingDetails({
      customerType,
      origin: input.origin,
      destination: input.destination,
      serviceCodes: quote.services.map((service) => service.code),
    });
    const result = await createMovingRequest(body, { quote, drivingDistance, bookingDetails });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    console.error("[moving-request] Order creation failed:", err);
    return NextResponse.json({ ok: false, reason: "ORDER_CREATION_FAILED" }, { status: 500 });
  }
}
