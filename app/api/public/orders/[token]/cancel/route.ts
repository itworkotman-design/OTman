import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrderByActionToken } from "@/lib/orders/publicOrderAccess";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { createOrderStatusChangedEvent } from "@/lib/orders/orderEvents";

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
