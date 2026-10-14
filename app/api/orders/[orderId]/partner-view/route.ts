import { movingAdjustmentsFromOrder } from "@/lib/orders/movingOrderCalculator";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getWebsiteOrderCatalog } from "@/lib/content/websiteOrderCatalog";
import { getMovingCatalog, type MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import { MOVING_ORDER_KIND } from "@/lib/orders/movingBookingDetails";
import { movingEditFromOrder } from "@/lib/orders/movingOrderEdit";
import { getOrderChargeAmountIncVatNok } from "@/lib/orders/orderTotals";
import {
  partnerPricesFromCalculator,
  partnerPricesFromMovingItems,
  partnerViewerRole,
  type PartnerPriceView,
} from "@/lib/orders/partnerOrderView";
import { parseWhiteGoodsBookingDetails, withLiveOrderFields } from "@/lib/orders/websiteBookingDetails";
import { websiteOrderCalculatorView } from "@/lib/orders/websiteOrderCalculator";
import { recomputeWebsiteOrderPricing, resolveSavedCatalogPricing } from "@/lib/orders/websiteOrderRepricing";
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// The booking app's read-only view of a homepage website order (delivery or
// move) — what ReadOnlyOrderModal shows the assigned partner (and an order
// creator) instead of re-pricing the order with the dashboard engine: the job
// as booked and the partner's price, line by line, from what's stored on the
// order (a delivery's through the same calculator as the admin modal, a
// move's from its stored lines), totalling the stored partner price. A
// partner never gets customer prices. Not a website order → NOT_WEBSITE_ORDER,
// and the modal keeps its old view.

type Params = { params: Promise<{ orderId: string }> };

const reject = (reason: string, status: number) => NextResponse.json({ ok: false, reason }, { status });

export async function GET(req: Request, { params }: Params) {
  const session = await getAuthenticatedSession(req);
  if (!session) return reject("UNAUTHORIZED", 401);
  if (!session.activeCompanyId) return reject("TENANT_SELECTION_REQUIRED", 409);

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, companyId: session.activeCompanyId, status: "ACTIVE" },
    select: { id: true, role: true, permissions: { select: { permission: true } } },
  });
  if (!membership) return reject("FORBIDDEN", 403);

  const { orderId } = await params;
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId: session.activeCompanyId },
    select: {
      id: true,
      displayId: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      customerName: true,
      phone: true,
      email: true,
      customerComments: true,
      description: true,
      driverInfo: true,
      priceExVat: true,
      priceSubcontractor: true,
      rabatt: true,
      leggTil: true,
      subcontractorMinus: true,
      subcontractorPlus: true,
      deviation: true,
      expressDelivery: true,
      floorNo: true,
      lift: true,
      subcontractorMembershipId: true,
      createdByMembershipId: true,
      customerMembershipId: true,
      websiteOrderKind: true,
      websiteBookingDetails: true,
      pickupAddress: true,
      deliveryAddress: true,
      extraPickupAddress: true,
      deliveryDate: true,
      timeWindow: true,
      drivingDistance: true,
      pricingSnapshot: true,
      productCardsSnapshot: true,
      items: {
        select: {
          optionId: true,
          productCode: true,
          optionCode: true,
          optionLabel: true,
          quantity: true,
          customerPriceCents: true,
          subcontractorPriceCents: true,
        },
      },
    },
  });
  const role = order
    ? partnerViewerRole({ ...membership, permissions: membership.permissions.map((p) => p.permission) }, order)
    : null;
  // Someone else's order looks just like a missing one.
  if (!order || !role) return reject("NOT_FOUND", 404);

  const common = {
    role,
    displayId: order.displayId,
    orderNumber: order.orderNumber,
    status: order.status,
    contact: {
      name: order.customerName ?? "",
      phone: order.phone ?? "",
      email: order.email ?? "",
      notes: order.customerComments ?? "",
    },
    description: order.description ?? "",
    driverInfo: order.driverInfo ?? "",
    // The customer's side only for who may see it (never the partner).
    customer:
      role === "partner"
        ? null
        : { totalExVat: order.priceExVat, totalIncVat: getOrderChargeAmountIncVatNok(order) },
  };

  // A move: both ends and timing, its stored lines.
  const movingEdit = order.websiteOrderKind === MOVING_ORDER_KIND ? movingEditFromOrder(order) : null;
  if (movingEdit) {
    let sizeOptions: MovingCatalogOption[] = [];
    try {
      sizeOptions = (await getMovingCatalog())?.options ?? [];
    } catch (err) {
      console.error("[partner-view] Couldn't load the moving catalog:", err);
    }
    return NextResponse.json({
      ok: true,
      view: {
        ...common,
        kind: "moving",
        moving: {
          edit: movingEdit,
          preferredDate: order.deliveryDate ?? "",
          timeWindow: order.timeWindow ?? "",
          drivingDistance: order.drivingDistance ?? "",
        },
        sizeOptions,
        partner: partnerPricesFromMovingItems(order.items, order.priceSubcontractor, movingAdjustmentsFromOrder(order)),
      },
    });
  }

  // A delivery: every stop as booked, priced like the admin modal does.
  const booked = order.websiteOrderKind === "WHITE_GOODS" ? parseWhiteGoodsBookingDetails(order.websiteBookingDetails) : null;
  if (!booked) return reject("NOT_WEBSITE_ORDER", 404);
  const details = withLiveOrderFields(booked, {
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    extraPickupAddress: order.extraPickupAddress ?? [],
    deliveryDate: order.deliveryDate,
    timeWindow: order.timeWindow,
    drivingDistance: order.drivingDistance,
  });

  // The order priced with the catalog prices it was saved with (as the admin
  // modal's calculator); if it can't be priced, just the stored total.
  let partner: PartnerPriceView = { groups: [], total: order.priceSubcontractor, mismatch: order.priceSubcontractor };
  try {
    const cards = Array.isArray(order.productCardsSnapshot) ? (order.productCardsSnapshot as unknown as SavedProductCard[]) : [];
    const catalog = await getWebsiteOrderCatalog();
    const catalogPricing = await resolveSavedCatalogPricing(order, cards, order.items ?? [], { catalog });
    const priced = await recomputeWebsiteOrderPricing(order, cards, { allowIncomplete: true, catalogPricing, catalog });
    const calculator = websiteOrderCalculatorView(priced.pricingResult, {
      includePartner: true,
      cards: priced.cards,
      products: priced.catalogProducts,
    });
    partner = partnerPricesFromCalculator(calculator, order.priceSubcontractor);
  } catch (err) {
    console.error("[partner-view] Couldn't price the order:", err);
  }

  return NextResponse.json({ ok: true, view: { ...common, kind: "white-goods", details, partner } });
}
