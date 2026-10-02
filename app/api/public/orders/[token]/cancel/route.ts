import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrderByActionToken } from "@/lib/orders/publicOrderAccess";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { createOrderStatusChangedEvent } from "@/lib/orders/orderEvents";
import { findCancelledOrderPartner } from "@/lib/orders/cancelledOrderPartner";
import { isPartnerTrackedOrder } from "@/lib/orders/partnerRequirement";

const CANCELLABLE_FROM = new Set(["rejected", "approved", "failed"]);

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByActionToken(token);

  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const normalizedStatus = normalizeOrderStatus(order.status);

  if (!CANCELLABLE_FROM.has(normalizedStatus)) {
    return NextResponse.json({ ok: false, reason: "ORDER_NOT_CANCELLABLE" }, { status: 409 });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "cancelled" },
  });

  // Fill the configured placeholder partner, but only if the order has none.
  // Done as a conditional write so partner data never passes through the
  // public token lookup.
  const cancelledPartner = isPartnerTrackedOrder(order.displayId)
    ? await findCancelledOrderPartner(prisma, order.companyId)
    : null;
  if (cancelledPartner) {
    await prisma.order.updateMany({
      where: {
        id: order.id,
        subcontractorMembershipId: null,
        OR: [{ subcontractor: null }, { subcontractor: "" }],
      },
      data: cancelledPartner,
    });
  }

  await createOrderStatusChangedEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: { source: "SYSTEM", name: "Customer" },
    fromStatus: order.status,
    toStatus: "cancelled",
    note: "Customer cancelled the order via the emailed action link.",
  });

  return NextResponse.json({ ok: true });
}
