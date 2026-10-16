import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reserveNextManualOrderNumber } from "@/lib/orders/orderNumber";
import { createOrderCreatedEvent, buildOrderEventSnapshot } from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { reservePublicOrderNumber } from "@/lib/orders/publicOrderNumber";
import { welcomeWebsiteOrderCustomer } from "@/lib/customerAccounts/welcomeWebsiteOrderCustomer";
import { parseServiceChoice, type ParsedServiceChoice } from "@/lib/content/serviceRequestCatalog";
import { buildServiceBookingDetails, SERVICE_ORDER_KIND } from "@/lib/orders/serviceBookingDetails";
import { serviceOrderDescription, serviceOrderSummary } from "@/lib/orders/serviceOrderEdit";
import {
  validateEmailField,
  validatePhoneField,
  validateTextField,
} from "@/lib/orders/websiteOrderValidation";

// Final submission for the homepage "Services" modal (ServiceRequestFlow):
// a trade/outsourcing job (electrician, carpenter, … or a custom service —
// lib/content/serviceRequestCatalog.ts) at one address. Lands unpriced, like
// the special-goods quote flow: staff review it and quote manually via the
// same approve/reject/Stripe pipeline every other website order uses. The
// job's address is stored as the order's delivery address (where we go); the
// answers are kept (serviceBookingDetails) so the admin WebsiteOrderModal
// shows and edits them, with staff's quote as the order's line.
// The older /tjenester page form still posts to /api/public/manpower.

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

async function createServiceRequest(
  body: RequestBody,
  service: Extract<ParsedServiceChoice, { ok: true }>,
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

  const customerType = body.customerType === "business" || body.customerType === "private" ? body.customerType : null;
  const jobDescription = str(body.jobDescription) ?? "";
  const description = serviceOrderDescription({ labelEn: service.labelEn, customerType, jobDescription });
  const summary = serviceOrderSummary(service.labelEn);
  const bookingDetails = buildServiceBookingDetails({
    customerType,
    serviceCode: service.code,
    customService: service.customService,
    jobDescription,
  });

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
      websiteOrderKind: SERVICE_ORDER_KIND,
      websiteBookingDetails: bookingDetails as unknown as Prisma.InputJsonValue,
      deliveryAddress: str(body.address),
      customerName: str(body.name),
      phone: str(body.phone),
      email: str(body.email),
      customerComments: str(body.notes),
      deliveryDate: str(body.preferredDate),
      timeWindow: str(body.timeWindow),
      description,
      productsSummary: summary,
      priceExVat: 0,
      priceSubcontractor: 0,
    },
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
    message: `Service request placed via the homepage — needs a manual quote before it can be approved. Customer: ${order.customerName ?? "—"}, Phone: ${order.phone ?? "—"}, Email: ${order.email ?? "—"}.`,
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

  // Honeypot: a bot filling every field gets a fake success, silently dropped.
  if (body._hp !== "" && body._hp !== undefined && body._hp !== null) {
    return NextResponse.json({ ok: true });
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

  // Required: the quote and payment link only ever reach the customer by email.
  if (!str(body.email)) {
    errors.email = "Required";
  } else {
    const emailErr = validateEmailField(s(body.email));
    if (emailErr) errors.email = emailErr;
  }

  const textFields = ["address", "jobDescription", "customService", "name", "timeWindow", "notes"];
  for (const field of textFields) {
    if (field in body && !(field in errors)) {
      const err = validateTextField(s(body[field]));
      if (err) errors[field] = err;
    }
  }

  if (!str(body.address)) errors.address = "Required";
  if (!str(body.jobDescription)) errors.jobDescription = "Required";
  if (!str(body.name)) errors.name = "Required";

  const service = parseServiceChoice(body.serviceCode, body.customService);
  if (!service.ok) {
    for (const [field, message] of Object.entries(service.errors)) errors[field] ??= message;
  }

  if (Object.keys(errors).length > 0 || !service.ok) {
    return NextResponse.json({ ok: false, reason: "VALIDATION_FAILED", errors }, { status: 422 });
  }

  try {
    const result = await createServiceRequest(body, service);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    console.error("[service-request] Order creation failed:", err);
    return NextResponse.json({ ok: false, reason: "ORDER_CREATION_FAILED" }, { status: 500 });
  }
}
