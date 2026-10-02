import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getModuleAccess } from "@/lib/users/access";
import { parseWhiteGoodsBookingDetails, withLiveOrderFields } from "@/lib/orders/websiteBookingDetails";
import {
  groupPricingLinesByCard,
  pricingLinesFromSnapshot,
  unexplainedPriceDifference,
} from "@/lib/orders/websiteOrderProducts";

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
      priceDifference: unexplainedPriceDifference(order.priceExVat, products, details.orderExtras),
      subcontractorMembershipId: order.subcontractorMembershipId,
      subcontractor: order.subcontractor,
      gsmSentAt: order.gsmSentAt ? order.gsmSentAt.toISOString() : null,
      gsmSyncStatus: order.gsmSyncStatus,
    },
  });
}
