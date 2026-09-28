import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOrderByActionToken } from "@/lib/orders/publicOrderAccess";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { getWebsiteOrderCatalog } from "@/lib/content/websiteOrderCatalog";
import { validateOrderItemEdits } from "@/lib/orders/validateOrderItemEdits";
import { findCardsWithSizeBracketProblems, findSizePricedCardsMissingName } from "@/lib/booking/pricing/sizeBrackets";
import { applyDimensionDerivedVolumeBrackets } from "@/lib/booking/pricing/sizeDimensions";
import { applyOrderPricingSnapshot } from "@/lib/booking/pricing/snapshot";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";
import { buildOrderSummaries } from "@/lib/orders/buildOrderSummaries";
import { buildOrderPricingSnapshot } from "@/lib/orders/orderTotals";
import { createOrderUpdatedEvent } from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import {
  applyWebsiteAssemblyExtras,
  buildWebsiteAssemblyExtraOrderItems,
} from "@/lib/booking/pricing/websiteAssemblyExtras";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { parseDistanceKm } from "@/lib/booking/pricing/orderCalculatorExtras";
import {
  applyWhiteGoodsExtraUnitCharges,
  buildWhiteGoodsExtraUnitOrderItems,
} from "@/lib/booking/pricing/whiteGoodsExtraUnits";
import { buildWhiteGoodsCalculatorBreakdowns } from "@/lib/booking/pricing/buildWhiteGoodsCalculatorBreakdowns";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import { normalizePriceListSettings } from "@/lib/products/priceListSettings";
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// "Forgot something?" — a customer on an already-confirmed (paid) order can
// reconfigure an existing product's delivery type/addons and pay the
// difference, without staff mediation, because the change is narrow enough
// to auto-price safely: it can only pick among already-known catalog prices
// for products already in the order (validateOrderItemEdits enforces this
// server-side, not just as a UI restriction) — never add a new product, a
// case still deliberately staff-mediated. See
// docs/homepage-ordering-roadmap.md §4.
//
// Re-runs the EXACT SAME pricing pipeline app/api/site/white-goods-order/
// route.ts uses to create an order in the first place, just with the
// submitted (modified) cards — this guarantees the recomputed total is
// consistent with how the order was priced originally, rather than a
// hand-rolled shortcut risking a different number. Order-level context
// (driving distance, express delivery, floors, lift, extra pickups) is
// preserved from the order as it already exists — the customer isn't
// resubmitting addresses here, only reconfiguring products — so those
// inputs to the pipeline don't change, only the per-card ones do.
//
// A change that would DECREASE the total is rejected outright: refunding a
// partial payment is a materially different feature (money going back out,
// not in) that nothing here builds — see the roadmap doc's own note on this.

// A size-priced product (Other furniture) must keep exactly one volume and one
// weight bracket — removing one would drop the real size/weight info from the
// order (and, for a waived bracket, change nothing in the price).
class SizeBracketSelectionError extends Error {}

// ...and it must keep its name (what the item is).
class ItemNameRequiredError extends Error {}

class PriceWouldDecreaseError extends Error {
  constructor() {
    super("This change would reduce the order total");
  }
}

// GET — fetches the order's existing cards + the current live catalog, so
// the client can render each product's delivery-type/addon choices exactly
// like the original booking flow did.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByActionToken(token);

  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  if (normalizeOrderStatus(order.status) !== "confirmed") {
    return NextResponse.json({ ok: false, reason: "NOT_ELIGIBLE" }, { status: 409 });
  }

  const productCards = Array.isArray(order.productCardsSnapshot) ? order.productCardsSnapshot : [];
  if (productCards.length === 0) {
    return NextResponse.json({ ok: false, reason: "NO_EDITABLE_ITEMS" }, { status: 409 });
  }

  try {
    const catalog = await getWebsiteOrderCatalog();
    return NextResponse.json({
      ok: true,
      displayId: order.displayId,
      productsSummary: order.productsSummary,
      productCards,
      catalogProducts: catalog.products,
      catalogSpecialOptions: catalog.specialOptions,
      priceListSettings: catalog.priceListSettings,
    });
  } catch (err) {
    console.error("[edit-items] Failed to load catalog:", err);
    return NextResponse.json({ ok: false, reason: "CATALOG_UNAVAILABLE" }, { status: 500 });
  }
}

async function recomputeOrderPricing(
  order: {
    drivingDistance: string | null;
    expressDelivery: boolean;
    floorNo: string | null;
    lift: string | null;
    extraPickupAddress: string[];
    rabatt: string | null;
    leggTil: string | null;
    subcontractorMinus: string | null;
    subcontractorPlus: string | null;
  },
  rawCards: SavedProductCard[],
) {
  const catalog = await getWebsiteOrderCatalog();

  // The volume bracket of a size-priced product is derived from its
  // width/height/length here, never taken from the client.
  const submittedCards = applyDimensionDerivedVolumeBrackets(rawCards, catalog.products);

  if (findCardsWithSizeBracketProblems(submittedCards, catalog.products).length > 0) {
    throw new SizeBracketSelectionError();
  }

  if (findSizePricedCardsMissingName(submittedCards, catalog.products).length > 0) {
    throw new ItemNameRequiredError();
  }

  // Never trust a per-card frozen pricingSnapshot here — a "Forgot
  // something?" edit should always price against the current live catalog,
  // not whatever was frozen at original booking time.
  const pricingSource = applyOrderPricingSnapshot({
    catalogProducts: catalog.products,
    catalogSpecialOptions: catalog.specialOptions,
    priceListSettings: catalog.priceListSettings,
    pricingSnapshot: null,
  });

  const builtItems = [
    ...buildOrderItemsFromCards(submittedCards, pricingSource.catalogProducts, pricingSource.catalogSpecialOptions),
    ...buildWhiteGoodsExtraUnitOrderItems(
      submittedCards,
      pricingSource.catalogProducts,
      pricingSource.catalogSpecialOptions,
    ),
    ...buildWebsiteAssemblyExtraOrderItems(submittedCards, pricingSource.catalogProducts),
  ];

  const summaries = buildOrderSummaries(submittedCards, pricingSource.catalogProducts, pricingSource.catalogSpecialOptions);
  const normalizedPriceListSettings = normalizePriceListSettings(catalog.priceListSettings);
  const priceLookup = buildPriceLookup(pricingSource.catalogProducts, pricingSource.catalogSpecialOptions);

  const drivingDistanceStr = order.drivingDistance ?? "";
  const floorNo = Number(order.floorNo) || 0;
  const liftAvailable = order.lift === "yes";
  const extraPickupsForPricing = (order.extraPickupAddress ?? []).map((address) => ({ address }));

  const productBreakdowns = applyWebsiteAssemblyExtras(
    applyWhiteGoodsExtraUnitCharges(
      buildProductBreakdowns(submittedCards, pricingSource.catalogProducts, pricingSource.catalogSpecialOptions, {
        zeroBaseDeliveryPricesOver100Km: parseDistanceKm(drivingDistanceStr) > 100,
      }),
      submittedCards,
      pricingSource.catalogProducts,
      pricingSource.catalogSpecialOptions,
    ),
    submittedCards,
    pricingSource.catalogProducts,
  );

  const fullBreakdowns = buildWhiteGoodsCalculatorBreakdowns({
    productBreakdowns,
    priceListSettings: normalizedPriceListSettings,
    drivingDistance: drivingDistanceStr,
    expressDelivery: order.expressDelivery === true,
    extraPickups: extraPickupsForPricing,
    pickupFloor: floorNo,
    deliveryFloor: floorNo,
    liftAvailable,
  });

  const pricingResult = calculateBookingPricing({
    productBreakdowns: fullBreakdowns,
    priceLookup,
    adjustments: {
      rabatt: order.rabatt ?? "",
      leggTil: order.leggTil ?? "",
      subcontractorMinus: order.subcontractorMinus ?? "",
      subcontractorPlus: order.subcontractorPlus ?? "",
    },
  });

  const pricingSnapshot = buildOrderPricingSnapshot({
    lines: builtItems,
    rabatt: order.rabatt,
    leggTil: order.leggTil,
    subcontractorMinus: order.subcontractorMinus,
    subcontractorPlus: order.subcontractorPlus,
    fallbackCustomerTotalExVat: pricingResult.totals.totalExVat,
    fallbackSubcontractorTotal: pricingResult.totals.subcontractorTotal,
  });

  return {
    // The cards with their derived size brackets — what gets persisted.
    cards: submittedCards,
    builtItems,
    summaries,
    pricingSnapshot,
    priceExVat: Math.round(pricingResult.totals.totalExVat),
    priceSubcontractor: Math.round(pricingResult.totals.subcontractorTotal),
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: { productCards?: unknown } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  const submittedCards = Array.isArray(body?.productCards) ? (body!.productCards as SavedProductCard[]) : null;
  if (!submittedCards || submittedCards.length === 0) {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  const order = await getOrderByActionToken(token);
  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  if (normalizeOrderStatus(order.status) !== "confirmed") {
    return NextResponse.json({ ok: false, reason: "NOT_ELIGIBLE" }, { status: 409 });
  }

  const originalCards = Array.isArray(order.productCardsSnapshot) ? (order.productCardsSnapshot as unknown as SavedProductCard[]) : [];
  if (originalCards.length === 0) {
    return NextResponse.json({ ok: false, reason: "NO_EDITABLE_ITEMS" }, { status: 409 });
  }

  const validation = validateOrderItemEdits(originalCards, submittedCards);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, reason: validation.reason }, { status: 422 });
  }

  try {
    const recomputed = await recomputeOrderPricing(order, submittedCards);
    const previousPriceExVat = order.priceExVat;

    if (recomputed.priceExVat < previousPriceExVat) {
      throw new PriceWouldDecreaseError();
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          productCardsSnapshot: recomputed.cards as unknown as Prisma.InputJsonValue,
          pricingSnapshot: recomputed.pricingSnapshot as unknown as Prisma.InputJsonValue,
          priceExVat: recomputed.priceExVat,
          priceSubcontractor: recomputed.priceSubcontractor,
          ...recomputed.summaries,
          needsNotificationAttention: true,
          lastNotificationAt: new Date(),
        },
      }),
      prisma.orderItem.deleteMany({ where: { orderId: order.id } }),
      ...recomputed.builtItems.map((item) =>
        prisma.orderItem.create({
          data: {
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
          },
        }),
      ),
    ]);

    await createOrderUpdatedEvent(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      actor: { source: "SYSTEM", name: "Customer" },
      changes: [
        {
          field: "priceExVat",
          label: "Price (ex VAT)",
          previousValue: String(previousPriceExVat),
          nextValue: String(recomputed.priceExVat),
        },
      ],
    });

    // The alert for staff — same in-app notification pattern every other
    // website-order flow this session uses.
    const deltaExVat = recomputed.priceExVat - previousPriceExVat;
    await createOrderNotification(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      type: "MANUAL_REVIEW",
      title: `Customer updated order #${order.displayId}`,
      message:
        deltaExVat > 0
          ? `Customer changed delivery/addon selections on their order — total increased by ${deltaExVat} kr (ex VAT). They'll be prompted to pay the difference.`
          : `Customer changed delivery/addon selections on their order — total is unchanged.`,
    });

    return NextResponse.json({
      ok: true,
      previousPriceExVat,
      newPriceExVat: recomputed.priceExVat,
      deltaExVat,
    });
  } catch (err) {
    if (err instanceof PriceWouldDecreaseError) {
      return NextResponse.json({ ok: false, reason: "WOULD_DECREASE_PRICE" }, { status: 422 });
    }
    if (err instanceof SizeBracketSelectionError) {
      return NextResponse.json({ ok: false, reason: "SIZE_BRACKETS_REQUIRED" }, { status: 422 });
    }
    if (err instanceof ItemNameRequiredError) {
      return NextResponse.json({ ok: false, reason: "ITEM_NAME_REQUIRED" }, { status: 422 });
    }
    console.error("[edit-items] Failed to apply order item edits:", err);
    return NextResponse.json({ ok: false, reason: "UPDATE_FAILED" }, { status: 500 });
  }
}
