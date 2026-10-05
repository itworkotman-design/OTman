import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getModuleAccess } from "@/lib/users/access";
import { parseWhiteGoodsBookingDetails, withLiveOrderFields } from "@/lib/orders/websiteBookingDetails";
import {
  groupPricingLinesByCard,
  pricingLinesFromSnapshot,
  checkWebsiteOrderTotals,
} from "@/lib/orders/websiteOrderProducts";
import { getOrderChargeAmountIncVatNok } from "@/lib/orders/orderTotals";
import { handlingFromOrder } from "@/lib/orders/websiteOrderHandling";
import { buildOrderStateSnapshot, compareOrderWithPayments } from "@/lib/orders/paidOrderSnapshot";
import { recomputeWebsiteOrderPricing } from "@/lib/orders/websiteOrderRepricing";
import { websiteOrderCalculatorView } from "@/lib/orders/websiteOrderCalculator";
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// Read-only view of a homepage white-goods website order for the admin
// WebsiteOrderModal. Kept separate from GET /api/orders/[orderId] (which backs
// the regular BookingEditor) so that route stays untouched. Any non-ok answer
// tells DashboardOrderModal to fall back to the regular OrderModal.
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await getAuthenticatedSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, companyId: session.activeCompanyId, status: "ACTIVE" },
    select: { role: true, appAccess: true },
  });
  const canView =
    !!membership &&
    (membership.role === "OWNER" ||
      membership.role === "ADMIN" ||
      getModuleAccess(membership, "WEBSITE_ORDERS").enabled);
  if (!canView) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }
  // Partner prices are for admins only, like the booking app's partner view.
  const websiteOrders = getModuleAccess(membership, "WEBSITE_ORDERS");
  const canSeePartnerPrices =
    membership.role === "OWNER" || membership.role === "ADMIN" || (websiteOrders.enabled && websiteOrders.level === "ADMIN");

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
      statusNotes: true,
      priceExVat: true,
      rabatt: true,
      leggTil: true,
      subcontractorMinus: true,
      subcontractorPlus: true,
      floorNo: true,
      lift: true,
      productCardsSnapshot: true,
      driver: true,
      secondDriver: true,
      driverInfo: true,
      licensePlate: true,
      deviation: true,
      description: true,
      expressDelivery: true,
      payments: { select: { amountChargedCents: true, createdAt: true, orderSnapshot: true } },
      websiteOrderKind: true,
      websiteBookingDetails: true,
      pricingSnapshot: true,
      pickupAddress: true,
      deliveryAddress: true,
      extraPickupAddress: true,
      deliveryDate: true,
      timeWindow: true,
      drivingDistance: true,
      subcontractorMembershipId: true,
      subcontractor: true,
      gsmSentAt: true,
      gsmSyncStatus: true,
    },
  });
  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const bookedDetails =
    order.websiteOrderKind === "WHITE_GOODS" ? parseWhiteGoodsBookingDetails(order.websiteBookingDetails) : null;
  if (!bookedDetails) {
    return NextResponse.json({ ok: false, reason: "NOT_WHITE_GOODS_WEBSITE_ORDER" }, { status: 404 });
  }

  // Addresses/date as they are now (an edit updates the columns, not the
  // stored details), and whatever the total holds beyond the booked lines.
  const details = withLiveOrderFields(bookedDetails, {
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    extraPickupAddress: order.extraPickupAddress ?? [],
    deliveryDate: order.deliveryDate,
    timeWindow: order.timeWindow,
    drivingDistance: order.drivingDistance,
  });
  const products = groupPricingLinesByCard(pricingLinesFromSnapshot(order.pricingSnapshot));

  // The calculator: the stored order priced the way it's saved, every line
  // with its customer and partner price. An order that can't be priced still
  // opens, just without it.
  let calculator = null;
  try {
    const cards = Array.isArray(order.productCardsSnapshot) ? (order.productCardsSnapshot as unknown as SavedProductCard[]) : [];
    const priced = await recomputeWebsiteOrderPricing(order, cards, { allowIncomplete: true });
    calculator = websiteOrderCalculatorView(priced.pricingResult, { includePartner: canSeePartnerPrices });
  } catch (err) {
    console.error("[website-details] Couldn't price the order for the calculator:", err);
  }

  return NextResponse.json({
    ok: true,
    order: {
      id: order.id,
      displayId: order.displayId,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      customerName: order.customerName,
      phone: order.phone,
      email: order.email,
      customerComments: order.customerComments,
      statusNotes: order.statusNotes,
      priceExVat: order.priceExVat,
      details,
      products,
      // Lines vs total vs what the customer was shown — any mismatch is a
      // warning in the modal (the customer pays what they were shown).
      totalsCheck: checkWebsiteOrderTotals({
        total: getOrderChargeAmountIncVatNok(order),
        products,
        orderExtras: details.orderExtras,
        rabatt: order.rabatt,
        leggTil: order.leggTil,
        shownTotal: details.shownTotal,
      }),
      subcontractorMembershipId: order.subcontractorMembershipId,
      subcontractor: order.subcontractor,
      gsmSentAt: order.gsmSentAt ? order.gsmSentAt.toISOString() : null,
      gsmSyncStatus: order.gsmSyncStatus,
      calculator,
      // The fields only an admin handles (driver, deviation, discount…).
      handling: handlingFromOrder(order),
      // Paid so far vs. the order now: what changed and what's due/refundable.
      payment: compareOrderWithPayments({
        payments: order.payments ?? [],
        current: buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] }),
      }),
    },
  });
}
