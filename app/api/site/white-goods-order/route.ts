import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import {
  applyOrderPricingSnapshot,
  getSavedOrderPricingSnapshot,
} from "@/lib/booking/pricing/snapshot";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";
import { buildOrderSummaries } from "@/lib/orders/buildOrderSummaries";
import { buildOrderPricingSnapshot } from "@/lib/orders/orderTotals";
import { reserveNextManualOrderNumber } from "@/lib/orders/orderNumber";
import {
  createOrderCreatedEvent,
  buildOrderEventSnapshot,
} from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { getWhiteGoodsPriceListId } from "@/lib/content/WhiteGoodsBookingConfig";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { parseDistanceKm } from "@/lib/booking/pricing/orderCalculatorExtras";
import { buildWhiteGoodsCalculatorBreakdowns } from "@/lib/booking/pricing/buildWhiteGoodsCalculatorBreakdowns";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import { normalizePriceListSettings } from "@/lib/products/priceListSettings";
import {
  validateEmailField,
  validatePhoneField,
  validateTextField,
} from "@/lib/orders/websiteOrderValidation";
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// Independent from transport-request's rate limiter by design — a separate
// public order-creation flow gets its own budget rather than sharing state
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

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function createWhiteGoodsOrder(
  body: RequestBody,
): Promise<{ orderId: string; displayId: number }> {
  const membershipId = process.env.WEBSITE_MEMBERSHIP_ID;
  if (!membershipId) throw new Error("WEBSITE_MEMBERSHIP_ID not configured");

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, companyId: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Website membership not found or inactive");
  }

  const priceListId = await getWhiteGoodsPriceListId();
  const catalog = await getBookingCatalog(priceListId);

  const productCards = (body.productCards as SavedProductCard[] | undefined) ?? [];

  const pricingSource = applyOrderPricingSnapshot({
    catalogProducts: catalog.products,
    catalogSpecialOptions: catalog.specialOptions,
    priceListSettings: catalog.priceListSettings,
    pricingSnapshot: getSavedOrderPricingSnapshot(productCards),
  });

  const builtItems = buildOrderItemsFromCards(
    productCards,
    pricingSource.catalogProducts,
    pricingSource.catalogSpecialOptions,
  );

  const summaries = buildOrderSummaries(
    productCards,
    pricingSource.catalogProducts,
    pricingSource.catalogSpecialOptions,
  );

  const normalizedPriceListSettings = normalizePriceListSettings(
    catalog.priceListSettings,
  );
  const priceLookup = buildPriceLookup(
    pricingSource.catalogProducts,
    pricingSource.catalogSpecialOptions,
  );

  const drivingDistanceStr = str(body.drivingDistance) ?? "";
  const expressDelivery = body.expressDelivery === true;
  const liftAvailable = body.liftAvailable === true;
  const pickupFloor = num(body.pickupFloor);
  const deliveryFloor = num(body.deliveryFloor);
  const extraPickupsForPricing = Array.isArray(body.extraPickupAddresses)
    ? (body.extraPickupAddresses as unknown[])
        .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        .map((address) => ({ address }))
    : [];

  const productBreakdowns = buildProductBreakdowns(
    productCards,
    pricingSource.catalogProducts,
    pricingSource.catalogSpecialOptions,
    {
      zeroBaseDeliveryPricesOver100Km: parseDistanceKm(drivingDistanceStr) > 100,
    },
  );

  const fullBreakdowns = buildWhiteGoodsCalculatorBreakdowns({
    productBreakdowns,
    priceListSettings: normalizedPriceListSettings,
    drivingDistance: drivingDistanceStr,
    expressDelivery,
    extraPickups: extraPickupsForPricing,
    pickupFloor,
    deliveryFloor,
    liftAvailable,
  });

  const pricingResult = calculateBookingPricing({
    productBreakdowns: fullBreakdowns,
    priceLookup,
  });

  const pricingSnapshot = buildOrderPricingSnapshot({
    lines: builtItems,
    rabatt: null,
    leggTil: null,
    subcontractorMinus: null,
    subcontractorPlus: null,
    fallbackCustomerTotalExVat: pricingResult.totals.totalExVat,
    fallbackSubcontractorTotal: pricingResult.totals.subcontractorTotal,
  });

  const displayId = await reserveNextManualOrderNumber(membership.companyId);

  const floorNoteParts = [
    pickupFloor > 0 ? `Pickup floor: ${pickupFloor}` : null,
    deliveryFloor > 0 ? `Delivery floor: ${deliveryFloor}` : null,
    `Lift available: ${liftAvailable ? "yes" : "no"}`,
  ].filter(Boolean);

  const order = await prisma.order.create({
    data: {
      companyId: membership.companyId,
      createdByMembershipId: membership.id,
      customerMembershipId: membership.id,
      priceListId,
      displayId,
      status: "processing",
      isWebsiteOrder: true,
      pickupAddress: str(body.pickupAddress),
      deliveryAddress: str(body.deliveryAddress),
      customerName: str(body.name),
      phone: str(body.phone),
      email: str(body.email),
      deliveryDate: str(body.preferredDate),
      timeWindow: str(body.timeWindow),
      drivingDistance: drivingDistanceStr || null,
      expressDelivery,
      extraPickupAddress: extraPickupsForPricing.map((p) => p.address),
      floorNo: String(Math.max(pickupFloor, deliveryFloor) || 0),
      lift: liftAvailable ? "yes" : "no",
      description: [str(body.notes), floorNoteParts.join(", ")]
        .filter(Boolean)
        .join("\n\n"),
      priceExVat: Math.round(pricingResult.totals.totalExVat),
      priceSubcontractor: Math.round(pricingResult.totals.subcontractorTotal),
      productCardsSnapshot: productCards as unknown as Prisma.InputJsonValue,
      pricingSnapshot: pricingSnapshot as unknown as Prisma.InputJsonValue,
      ...summaries,
    },
  });

  if (builtItems.length > 0) {
    await prisma.orderItem.createMany({
      data: builtItems.map((item) => ({
        orderId: order.id,
        cardId: item.cardId,
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        deliveryType: item.deliveryType,
        itemType: item.itemType,
        optionId: item.optionId,
        optionCode: item.optionCode,
        optionLabel: item.optionLabel,
        quantity: item.quantity,
        customerPriceCents: item.customerPriceCents,
        subcontractorPriceCents: item.subcontractorPriceCents,
        rawData: item.rawData as Prisma.InputJsonValue,
      })),
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
      ...summaries,
    }),
  });

  await createOrderNotification(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    type: "MANUAL_REVIEW",
    title: "WEBSITE ORDER - White goods / electronics",
    message: `Order placed via the homepage white-goods flow. Customer: ${order.customerName ?? "—"}, Phone: ${order.phone ?? "—"}, Email: ${order.email ?? "—"}.`,
  });

  return { orderId: order.id, displayId: order.displayId };
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

  const emailErr = validateEmailField(s(body.email));
  if (emailErr) errors.email = emailErr;

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
  if (!Array.isArray(body.productCards) || body.productCards.length === 0) {
    errors.productCards = "At least one product is required";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { ok: false, reason: "VALIDATION_FAILED", errors },
      { status: 422 },
    );
  }

  try {
    const result = await createWhiteGoodsOrder(body);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    console.error("[white-goods-order] Order creation failed:", err);
    return NextResponse.json({ ok: false, reason: "ORDER_CREATION_FAILED" }, { status: 500 });
  }
}
