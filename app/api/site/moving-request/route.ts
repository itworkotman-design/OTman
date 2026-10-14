import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { movingCarrySurchargeLines, movingDistanceLines, movingFloorSurchargeLines, movingOrderPricing } from "@/lib/orders/movingOrderPricing";
import { parseDistanceKm } from "@/lib/booking/pricing/orderCalculatorExtras";
import { getRouteDistance } from "@/lib/integrations/mapbox/routeDistance";
import { movingOrderDescription } from "@/lib/orders/movingOrderDescription";
import { movingChargeableFloors, movingPropertyLine, parseMovingProperty } from "@/lib/orders/movingProperty";
import { reserveNextManualOrderNumber } from "@/lib/orders/orderNumber";
import { createOrderCreatedEvent, buildOrderEventSnapshot } from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { reservePublicOrderNumber } from "@/lib/orders/publicOrderNumber";
import { welcomeWebsiteOrderCustomer } from "@/lib/customerAccounts/welcomeWebsiteOrderCustomer";
import {
  findMovingServiceOptions,
  findMovingSizeOption,
  getMovingCatalog,
  type MovingCatalogOption,
} from "@/lib/content/getMovingCatalog";
import {
  MOVING_CARRY_SURCHARGE_PRODUCT_CODE,
  MOVING_DISTANCE_ITEM_CODE,
  MOVING_FLOOR_SURCHARGE_PRODUCT_CODE,
  MOVING_SERVICES_PRODUCT_CODE,
} from "@/lib/content/movingCatalog";
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

// Driving distance pickup → delivery (km, as Mapbox returns it), or "" when
// the lookup fails.
async function lookUpDrivingDistance(pickupAddress: string, deliveryAddress: string): Promise<string> {
  try {
    const result = await getRouteDistance({ pickupAddress: pickupAddress.trim(), deliveryAddress: deliveryAddress.trim() });
    return result?.distanceKm ?? "";
  } catch (err) {
    console.error("[moving-request] Driving distance lookup failed:", err);
    return "";
  }
}

class CatalogNotSeededError extends Error {
  constructor() {
    super("Moving catalog not seeded — run `npm run seed:moving-catalog`");
  }
}

async function createMovingRequest(
  body: RequestBody,
  {
    sizeOption,
    originLine,
    destinationLine,
    services,
    floorSurchargeLines,
    carrySurchargeLines,
    drivingDistance,
    distanceLines,
  }: {
    // The origin's size bracket — what the move is priced on.
    sizeOption: MovingCatalogOption;
    originLine: string;
    destinationLine: string;
    services: MovingCatalogOption[];
    // No-lift floor surcharge, one line per end (movingFloorSurchargeLines).
    floorSurchargeLines: ReturnType<typeof movingFloorSurchargeLines>;
    // Carrying-distance surcharge, one line per end (movingCarrySurchargeLines).
    carrySurchargeLines: ReturnType<typeof movingCarrySurchargeLines>;
    // Driving distance pickup → delivery as looked up here ("" if it failed),
    // and its km charge (movingDistanceLines).
    drivingDistance: string;
    distanceLines: ReturnType<typeof movingDistanceLines>;
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
    originLine,
    destinationLine,
    serviceLabels: services.map((service) => service.labelEn),
    notes: str(body.notes),
  });
  const summary = [
    `Moving (${sizeOption.labelEn})`,
    ...services.map((service) => service.labelEn),
    ...floorSurchargeLines.map((line) => line.labelEn),
    ...carrySurchargeLines.map((line) => line.labelEn),
    ...distanceLines.map((line) => line.labelEn),
  ].join(" + ");

  const movingPricing = movingOrderPricing(sizeOption, [...services, ...floorSurchargeLines, ...carrySurchargeLines, ...distanceLines]);
  const order = await prisma.order.create({
    data: {
      companyId: membership.companyId,
      createdByMembershipId: membership.id,
      customerMembershipId: membership.id,
      displayId,
      orderNumber,
      status: "processing",
      isWebsiteOrder: true,
      pickupAddress: str(body.pickupAddress),
      deliveryAddress: str(body.deliveryAddress),
      drivingDistance: drivingDistance || null,
      customerName: str(body.name),
      phone: str(body.phone),
      email: str(body.email),
      deliveryDate: str(body.preferredDate),
      timeWindow: str(body.timeWindow),
      description,
      // Ex. VAT, with what the customer pays (incl. VAT, whole kroner) in the snapshot.
      ...movingPricing,
      pricingSnapshot: movingPricing.pricingSnapshot as unknown as Prisma.InputJsonValue,
      productsSummary: summary,
    },
  });

  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      cardId: 0,
      productCode: "MOVING_BY_SIZE",
      productName: "Moving",
      itemType: "product",
      optionCode: sizeOption.code,
      optionLabel: sizeOption.labelEn,
      quantity: 1,
      customerPriceCents: sizeOption.customerPriceCents,
      subcontractorPriceCents: sizeOption.subcontractorPriceCents,
    },
  });

  for (const service of services) {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        cardId: 0,
        productCode: MOVING_SERVICES_PRODUCT_CODE,
        productName: "Additional service",
        itemType: "product",
        optionCode: service.code,
        optionLabel: service.labelEn,
        quantity: 1,
        customerPriceCents: service.customerPriceCents,
        subcontractorPriceCents: service.subcontractorPriceCents,
      },
    });
  }

  for (const line of floorSurchargeLines) {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        cardId: 0,
        productCode: MOVING_FLOOR_SURCHARGE_PRODUCT_CODE,
        productName: "Floor surcharge",
        itemType: "product",
        optionCode: line.code,
        optionLabel: line.labelEn,
        // Unit price per floor × chargeable floors.
        quantity: line.quantity,
        customerPriceCents: line.customerPriceCents / line.quantity,
        subcontractorPriceCents: line.subcontractorPriceCents / line.quantity,
      },
    });
  }

  for (const line of carrySurchargeLines) {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        cardId: 0,
        productCode: MOVING_CARRY_SURCHARGE_PRODUCT_CODE,
        productName: "Carrying distance",
        itemType: "product",
        optionCode: line.code,
        optionLabel: line.labelEn,
        quantity: 1,
        customerPriceCents: line.customerPriceCents,
        subcontractorPriceCents: line.subcontractorPriceCents,
      },
    });
  }

  for (const line of distanceLines) {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        cardId: 0,
        productCode: MOVING_DISTANCE_ITEM_CODE,
        productName: "Driving distance",
        itemType: "product",
        optionCode: line.code,
        optionLabel: line.labelEn,
        // Per-km rate × chargeable km.
        quantity: line.quantity,
        customerPriceCents: line.customerPriceCents / line.quantity,
        subcontractorPriceCents: line.subcontractorPriceCents / line.quantity,
      },
    });
  }

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

    // The price is the origin's size bracket (how much gets moved); the
    // destination's size is information for staff, but must still be real.
    const origin = ends.origin.property;
    const destination = ends.destination.property;
    const originSize = findMovingSizeOption(catalog.options, origin.sizeOptionCode);
    const destinationSize = findMovingSizeOption(catalog.options, destination.sizeOptionCode);
    if (!originSize || !destinationSize) {
      const sizeErrors: Record<string, string> = {};
      if (!originSize) sizeErrors["origin.sizeOptionCode"] = "Unknown size option";
      if (!destinationSize) sizeErrors["destination.sizeOptionCode"] = "Unknown size option";
      return NextResponse.json({ ok: false, reason: "VALIDATION_FAILED", errors: sizeErrors }, { status: 422 });
    }

    const services = findMovingServiceOptions(catalog.services, body.serviceCodes);
    if (!services) {
      return NextResponse.json(
        { ok: false, reason: "VALIDATION_FAILED", errors: { serviceCodes: "Unknown additional service" } },
        { status: 422 },
      );
    }

    // The km charge comes from the distance looked up here, never from the
    // client. A failed lookup charges no km (logged) — staff review every
    // website order before approving it anyway.
    const drivingDistance = await lookUpDrivingDistance(s(body.pickupAddress), s(body.deliveryAddress));

    const result = await createMovingRequest(body, {
      sizeOption: originSize,
      originLine: movingPropertyLine(origin, originSize.labelEn),
      destinationLine: movingPropertyLine(destination, destinationSize.labelEn),
      services,
      floorSurchargeLines: movingFloorSurchargeLines(catalog.floorSurcharge, [
        { label: "moving from", chargeableFloors: movingChargeableFloors(origin) },
        { label: "moving to", chargeableFloors: movingChargeableFloors(destination) },
      ]),
      carrySurchargeLines: movingCarrySurchargeLines(catalog.carrySurcharges ?? [], [
        { label: "moving from", parking: origin.parking.code },
        { label: "moving to", parking: destination.parking.code },
      ]),
      drivingDistance,
      distanceLines: movingDistanceLines(catalog.distanceRates ?? null, parseDistanceKm(drivingDistance)),
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    console.error("[moving-request] Order creation failed:", err);
    return NextResponse.json({ ok: false, reason: "ORDER_CREATION_FAILED" }, { status: 500 });
  }
}
