import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reserveNextManualOrderNumber } from "@/lib/orders/orderNumber";
import { createOrderCreatedEvent, buildOrderEventSnapshot } from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { reservePublicOrderNumber } from "@/lib/orders/publicOrderNumber";
import { sendOrderReceivedEmail } from "@/lib/orders/sendOrderReceivedEmail";
import { promoteTempAttachmentToOrders } from "@/lib/orders/orderAttachmentStorage";
import {
  isValidQuoteToken,
  linkPendingQuoteAttachments,
  promotePendingQuoteAttachments,
} from "@/lib/orders/pendingQuoteAttachments";
import {
  validateEmailField,
  validatePhoneField,
  validateTextField,
} from "@/lib/orders/websiteOrderValidation";

// Final submission for the "Andre varer"/"Spesialvarer" quote-request flow —
// items too unusual/oversized to auto-price. Lands unpriced (same pattern as
// Moving before it — see docs/homepage-ordering-roadmap.md §6/§5), staff
// review the description + any uploaded photos and quote manually via the
// same approve/reject/Stripe pipeline every other website order uses.
// Photos are optional — quoteToken may be empty if the customer didn't
// upload any; only a present-but-malformed token is rejected.

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

async function createSpecialGoodsQuote(body: RequestBody): Promise<{ orderId: string; displayId: number; orderNumber: string | null }> {
  const membershipId = process.env.WEBSITE_MEMBERSHIP_ID;
  if (!membershipId) throw new Error("WEBSITE_MEMBERSHIP_ID not configured");

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, companyId: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Website membership not found or inactive");
  }

  // Photos are staged under tmp/ (auto-expiring) until now. Move them to their
  // permanent keys BEFORE the order exists, so a failed copy aborts the
  // submission cleanly (nothing created, no order number burned) and a retry
  // just picks up where this left off.
  const quoteToken = str(body.quoteToken);
  const hasQuoteToken = !!quoteToken && isValidQuoteToken(quoteToken);
  if (hasQuoteToken) {
    await promotePendingQuoteAttachments(prisma, { quoteToken, promote: promoteTempAttachmentToOrders });
  }

  const displayId = await reserveNextManualOrderNumber(membership.companyId);
  // The random number customers see; displayId stays internal/sequential.
  const orderNumber = await reservePublicOrderNumber(prisma, membership.companyId);

  const dimensionParts = [str(body.sizeW), str(body.sizeH), str(body.sizeL)].filter(Boolean);
  const descriptionParts = [
    str(body.description),
    dimensionParts.length > 0 ? `Approximate dimensions (W×H×L): ${dimensionParts.join(" × ")}` : null,
    str(body.weight) ? `Weight: ${str(body.weight)}` : null,
    str(body.units) ? `Units: ${str(body.units)}` : null,
    str(body.notes),
  ].filter(Boolean);

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
      customerName: str(body.name),
      phone: str(body.phone),
      email: str(body.email),
      deliveryDate: str(body.preferredDate),
      timeWindow: str(body.timeWindow),
      description: descriptionParts.join("\n\n") || null,
      productsSummary: "Special / other goods (needs a quote)",
      priceExVat: 0,
      priceSubcontractor: 0,
    },
  });

  const linkedPhotoCount = hasQuoteToken
    ? await linkPendingQuoteAttachments(prisma, { orderId: order.id, quoteToken })
    : 0;

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
    title: "WEBSITE ORDER - Special/other goods (needs a quote)",
    message: `Special-goods quote request placed via the homepage${linkedPhotoCount > 0 ? ` with ${linkedPhotoCount} photo(s)` : ""} — needs a manual quote before it can be approved. Customer: ${order.customerName ?? "—"}, Phone: ${order.phone ?? "—"}, Email: ${order.email ?? "—"}.`,
  });

  // Best-effort (never throws) — the order is already saved.
  await sendOrderReceivedEmail(order);

  return { orderId: order.id, displayId: order.displayId, orderNumber: order.orderNumber };
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  // Honeypot: a bot filling every field gets a fake success, silently
  // dropped — same pattern as app/api/public/vehicle-booking/route.ts.
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

  if (!str(body.email)) {
    errors.email = "Required";
  } else {
    const emailErr = validateEmailField(s(body.email));
    if (emailErr) errors.email = emailErr;
  }

  const textFields = ["pickupAddress", "deliveryAddress", "name", "timeWindow", "description", "notes"];
  for (const field of textFields) {
    if (field in body && !(field in errors)) {
      const err = validateTextField(s(body[field]));
      if (err) errors[field] = err;
    }
  }

  if (!str(body.pickupAddress)) errors.pickupAddress = "Required";
  if (!str(body.name)) errors.name = "Required";
  if (!str(body.description)) errors.description = "Required";

  const quoteToken = str(body.quoteToken);
  if (quoteToken && !isValidQuoteToken(quoteToken)) {
    errors.quoteToken = "Invalid";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, reason: "VALIDATION_FAILED", errors }, { status: 422 });
  }

  try {
    const result = await createSpecialGoodsQuote(body);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    console.error("[special-goods-quote] Order creation failed:", err);
    return NextResponse.json({ ok: false, reason: "ORDER_CREATION_FAILED" }, { status: 500 });
  }
}
