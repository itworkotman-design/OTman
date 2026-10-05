import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  applyOrderPricingSnapshot,
  getSavedOrderPricingSnapshot,
} from "@/lib/booking/pricing/snapshot";
import { buildOrderSummaries } from "@/lib/orders/buildOrderSummaries";
import { buildOrderPricingSnapshot } from "@/lib/orders/orderTotals";
import { reserveNextManualOrderNumber } from "@/lib/orders/orderNumber";
import {
  createOrderCreatedEvent,
  buildOrderEventSnapshot,
} from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { reservePublicOrderNumber } from "@/lib/orders/publicOrderNumber";
import { welcomeWebsiteOrderCustomer } from "@/lib/customerAccounts/welcomeWebsiteOrderCustomer";
import { getWebsiteOrderCatalog } from "@/lib/content/websiteOrderCatalog";
import { findWebsiteCatalogByProductCode } from "@/lib/content/websiteCatalogs";
import { validateWebsiteOrderCards } from "@/lib/orders/validateWebsiteOrderCards";
import { costliestFloor, parseFloorNumber } from "@/lib/booking/floorNumber";
import { buildPickupNoteLines, buildWebsiteOrderTextFields } from "@/lib/orders/websiteOrderNotes";
import { buildWhiteGoodsBookingDetails } from "@/lib/orders/websiteBookingDetails";
import { buildWebsiteOrderItems, priceWebsiteOrder } from "@/lib/booking/pricing/priceWebsiteOrder";
import { normalizePriceListSettings } from "@/lib/products/priceListSettings";
import {
  validateEmailField,
  validatePhoneField,
  validateTextField,
} from "@/lib/orders/websiteOrderValidation";
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import {
  extraPickupFloorsForPricing,
  parseExtraPickupLocations,
} from "@/lib/orders/websiteExtraPickupLocations";

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

const PICKUP_SOURCE_LABELS: Record<string, string> = {
  store: "Store",
  private: "Private individual",
  business: "Business",
};

function pickupSourceLabel(v: unknown): string | null {
  const key = typeof v === "string" ? v : "";
  return PICKUP_SOURCE_LABELS[key] ?? null;
}

function str(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return s || null;
}

class UnsellableProductError extends Error {
  constructor() {
    super("Order contains a product that isn't sold on the website");
  }
}

class ItemNameError extends Error {
  constructor() {
    super("A size-priced product needs a short, plain-text name saying what the item is");
  }
}

class InstallOptionRequiredError extends Error {
  constructor() {
    super("An installation-only product needs an installation option");
  }
}

class ShownTotalRequiredError extends Error {
  constructor() {
    super("The order must say which total the customer was shown");
  }
}

class PriceChangedError extends Error {
  constructor(readonly total: number) {
    super("The total the customer was shown is not the current price");
  }
}

class SizeBracketSelectionError extends Error {
  constructor() {
    super("A product priced by size needs exactly one volume and one weight bracket");
  }
}

async function createWhiteGoodsOrder(
  body: RequestBody,
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

  // Every seeded website price list merged into one catalog (fees and special
  // options from the first list), so an order can mix products from several
  // lists and still be priced by the one shared calculator. The order itself
  // is filed under the first list.
  const catalog = await getWebsiteOrderCatalog();
  const priceListId = catalog.priceListId;

  const submittedCards = (body.productCards as SavedProductCard[] | undefined) ?? [];

  // Unsellable products, size brackets (derived from the dimensions), install-
  // only items and item names — the same rules a later "My order" edit gets.
  const cardsCheck = validateWebsiteOrderCards(submittedCards, catalog.products);
  if (!cardsCheck.ok) {
    if (cardsCheck.reason === "UNKNOWN_PRODUCT") throw new UnsellableProductError();
    if (cardsCheck.reason === "SIZE_BRACKETS_REQUIRED") throw new SizeBracketSelectionError();
    if (cardsCheck.reason === "INSTALL_OPTION_REQUIRED") throw new InstallOptionRequiredError();
    throw new ItemNameError();
  }
  const productCards = cardsCheck.cards;

  const pricingSource = applyOrderPricingSnapshot({
    catalogProducts: catalog.products,
    catalogSpecialOptions: catalog.specialOptions,
    priceListSettings: catalog.priceListSettings,
    pricingSnapshot: getSavedOrderPricingSnapshot(productCards),
  });

  const summaries = buildOrderSummaries(
    productCards,
    pricingSource.catalogProducts,
    pricingSource.catalogSpecialOptions,
  );

  const normalizedPriceListSettings = normalizePriceListSettings(
    catalog.priceListSettings,
  );

  const drivingDistanceStr = str(body.drivingDistance) ?? "";
  const expressDelivery = body.expressDelivery === true;
  // A store pickup never asks for a floor/lift on the client — stores always
  // have loading access — so the pickup leg is authoritatively treated as
  // ground floor with a lift here, regardless of what the client sent.
  const isStorePickup = body.pickupSource === "store";
  const pickupFloor = isStorePickup ? 0 : parseFloorNumber(body.pickupFloor);
  const deliveryFloor = parseFloorNumber(body.deliveryFloor);
  const pickupLiftAvailable = isStorePickup ? true : body.pickupLiftAvailable === true;
  const deliveryLiftAvailable = body.deliveryLiftAvailable === true;
  // The homepage flow lets a customer split their order across several
  // pickup addresses (see pickupLocations.ts on the client) — extraPickupLocations
  // carries those in full (address, contact, which products); the older,
  // address-only extraPickupAddresses stays supported as a fallback.
  const extraPickupLocations = parseExtraPickupLocations(body.extraPickupLocations);
  const extraPickupsForPricing =
    extraPickupLocations.length > 0
      ? extraPickupLocations.map((loc) => ({ address: loc.address as string }))
      : Array.isArray(body.extraPickupAddresses)
        ? (body.extraPickupAddresses as unknown[])
            .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
            .map((address) => ({ address }))
        : [];

  // THE price — the same function the customer's summary used
  // (priceWebsiteOrder), so the total below is the one they were shown.
  const { result: pricingResult, orderExtras } = priceWebsiteOrder({
    cards: productCards,
    catalogProducts: pricingSource.catalogProducts,
    catalogSpecialOptions: pricingSource.catalogSpecialOptions,
    priceListSettings: normalizedPriceListSettings,
    drivingDistance: drivingDistanceStr,
    expressDelivery,
    extraPickups: extraPickupsForPricing,
    pickupFloor,
    deliveryFloor,
    pickupLiftAvailable,
    deliveryLiftAvailable,
    extraPickupFloors: extraPickupFloorsForPricing(extraPickupLocations),
  });

  // The customer pays what they were shown, so the order is only stored when
  // that is exactly the price calculated here. Anything else (stale catalog,
  // a pricing bug, a tampered request) is refused with the real price rather
  // than stored at a total the customer never saw.
  const shownTotal = typeof body.shownTotal === "number" && Number.isFinite(body.shownTotal) ? body.shownTotal : null;
  if (shownTotal === null) throw new ShownTotalRequiredError();
  if (Math.abs(shownTotal - pricingResult.totals.totalExVat) >= 0.5) {
    console.error("[white-goods-order] Shown total differs from server total", {
      shownTotal,
      serverTotal: pricingResult.totals.totalExVat,
    });
    throw new PriceChangedError(pricingResult.totals.totalExVat);
  }

  const builtItems = buildWebsiteOrderItems(productCards, pricingSource.catalogProducts, pricingSource.catalogSpecialOptions, {
    drivingDistance: drivingDistanceStr,
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
  // The random number customers see; displayId stays internal/sequential.
  const orderNumber = await reservePublicOrderNumber(prisma, membership.companyId);

  const pickupPlaceNameStr = str(body.pickupPlaceName);
  const pickupContactNameStr = str(body.pickupContactName);
  const pickupContactPhoneStr = str(body.pickupContactPhone);

  const orderFloorNo = String(costliestFloor(pickupFloor, deliveryFloor));
  // Legacy single field (see edit-items re-pricing) — "yes" only when
  // neither end would incur a floor surcharge, the safer combined value.
  const orderLift = pickupLiftAvailable && deliveryLiftAvailable ? "yes" : "no";

  // Only non-empty once the order was actually split across more than one
  // pickup address — see websiteExtraPickupLocations.ts.
  const firstLocationProductNames = Array.isArray(body.pickupProductNames)
    ? (body.pickupProductNames as unknown[]).filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    : [];
  // One description line per pickup stop (see buildPickupNoteLines).
  const pickupNoteLines = buildPickupNoteLines({
    stops: [
      {
        source: typeof body.pickupSource === "string" ? body.pickupSource : null,
        placeName: pickupPlaceNameStr,
        address: str(body.pickupAddress),
        floor: pickupFloor,
        liftAvailable: pickupLiftAvailable,
        contactName: pickupContactNameStr,
        contactPhone: pickupContactPhoneStr,
        productNames: firstLocationProductNames,
      },
      ...extraPickupLocations,
    ],
    deliveryFloor,
    deliveryLiftAvailable,
    orderFloorNo,
    orderLift,
  });

  // Structured copy of what the customer entered, for the admin
  // WebsiteOrderModal (see websiteBookingDetails.ts).
  const websiteBookingDetails = buildWhiteGoodsBookingDetails({
    customerType: body.customerType,
    firstPickup: {
      source: body.pickupSource,
      placeName: pickupPlaceNameStr,
      address: str(body.pickupAddress),
      floor: pickupFloor,
      liftAvailable: pickupLiftAvailable,
      contactName: pickupContactNameStr,
      contactPhone: pickupContactPhoneStr,
      productNames: firstLocationProductNames,
      // Which product cards are collected here (for the admin editor).
      ...(Array.isArray(body.pickupCardIds)
        ? { cardIds: (body.pickupCardIds as unknown[]).filter((id): id is number => Number.isInteger(id)) }
        : {}),
    },
    extraPickups: extraPickupLocations,
    delivery: { address: str(body.deliveryAddress), floor: deliveryFloor, liftAvailable: deliveryLiftAvailable },
    preferredDate: str(body.preferredDate),
    timeWindow: str(body.timeWindow),
    drivingDistance: drivingDistanceStr || null,
    // Same lines the homepage summary shows (WhiteGoodsBookingFlow's
    // orderExtraLines).
    orderExtras,
    shownTotal,
  });

  const order = await prisma.order.create({
    data: {
      companyId: membership.companyId,
      createdByMembershipId: membership.id,
      customerMembershipId: membership.id,
      priceListId,
      displayId,
      orderNumber,
      status: "processing",
      isWebsiteOrder: true,
      websiteOrderKind: "WHITE_GOODS",
      websiteBookingDetails: websiteBookingDetails as unknown as Prisma.InputJsonValue,
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
      floorNo: orderFloorNo,
      lift: orderLift,
      ...buildWebsiteOrderTextFields({
        customerComment: str(body.notes),
        noteLines: pickupNoteLines,
        multiPickupLines: [],
      }),
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

  const catalogLabels =
    [
      ...new Set(
        productCards.flatMap((card) => {
          const code = catalog.products.find((p) => p.id === card.productId)?.code;
          const found = code ? findWebsiteCatalogByProductCode(code) : null;
          return found ? [found.labelEn] : [];
        }),
      ),
    ].join(" + ") || "Website";

  await createOrderNotification(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    type: "MANUAL_REVIEW",
    title: `WEBSITE ORDER - ${catalogLabels}`,
    message: `Order placed via the homepage website order flow (${catalogLabels}). Customer: ${order.customerName ?? "—"}, Phone: ${order.phone ?? "—"}, Email: ${order.email ?? "—"}.`,
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

  // Mandatory: the order-received confirmation and the later payment link
  // are emailed, so an order without an address can never be completed.
  if (!str(body.email)) {
    errors.email = "Required";
  } else {
    const emailErr = validateEmailField(s(body.email));
    if (emailErr) errors.email = emailErr;
  }

  const textFields = ["pickupAddress", "deliveryAddress", "name", "timeWindow", "notes", "pickupPlaceName", "pickupContactName"];
  for (const field of textFields) {
    if (field in body && !(field in errors)) {
      const err = validateTextField(s(body[field]));
      if (err) errors[field] = err;
    }
  }

  if (!str(body.pickupAddress)) errors.pickupAddress = "Required";
  if (!str(body.deliveryAddress)) errors.deliveryAddress = "Required";
  const pickupSourceValue = pickupSourceLabel(body.pickupSource) ? String(body.pickupSource) : null;
  if (!pickupSourceValue) errors.pickupSource = "Required";
  // Which pickup-contact fields are required depends on the pickup source
  // (see PickupContactCard/isPickupContactStepReady on the client).
  if (pickupSourceValue === "store" || pickupSourceValue === "business") {
    if (!str(body.pickupPlaceName)) errors.pickupPlaceName = "Required";
  }
  if (pickupSourceValue === "private" || pickupSourceValue === "business") {
    if (!str(body.pickupContactName)) errors.pickupContactName = "Required";
    if (!str(body.pickupContactPhone)) {
      errors.pickupContactPhone = "Required";
    } else {
      const contactPhoneErr = validatePhoneField(s(body.pickupContactPhone));
      if (contactPhoneErr) errors.pickupContactPhone = contactPhoneErr;
    }
  }
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
    if (err instanceof ShownTotalRequiredError) {
      return NextResponse.json({ ok: false, reason: "SHOWN_TOTAL_REQUIRED" }, { status: 400 });
    }
    if (err instanceof PriceChangedError) {
      return NextResponse.json({ ok: false, reason: "PRICE_CHANGED", total: err.total }, { status: 409 });
    }
    if (err instanceof UnsellableProductError) {
      return NextResponse.json(
        { ok: false, reason: "VALIDATION_FAILED", errors: { productCards: "Unknown product" } },
        { status: 422 },
      );
    }
    if (err instanceof ItemNameError) {
      return NextResponse.json(
        {
          ok: false,
          reason: "VALIDATION_FAILED",
          errors: { productCards: "Say what the item is (a short name, up to 80 characters, no special characters)" },
        },
        { status: 422 },
      );
    }
    if (err instanceof InstallOptionRequiredError) {
      return NextResponse.json(
        { ok: false, reason: "VALIDATION_FAILED", errors: { productCards: "Choose which installation you need" } },
        { status: 422 },
      );
    }
    if (err instanceof SizeBracketSelectionError) {
      return NextResponse.json(
        { ok: false, reason: "VALIDATION_FAILED", errors: { productCards: "Choose the size (width, height, length) and weight of the item" } },
        { status: 422 },
      );
    }
    console.error("[white-goods-order] Order creation failed:", err);
    return NextResponse.json({ ok: false, reason: "ORDER_CREATION_FAILED" }, { status: 500 });
  }
}
