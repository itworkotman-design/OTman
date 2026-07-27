import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrderByActionToken } from "@/lib/orders/publicOrderAccess";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { createOrderStatusChangedEvent } from "@/lib/orders/orderEvents";
import { getGmailSendAsEmail } from "@/lib/email/gmailAccounts";

const REQUESTABLE_FROM = new Set(["rejected", "approved", "failed"]);

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ ok: false, reason: "MESSAGE_REQUIRED" }, { status: 400 });
  }

  const order = await getOrderByActionToken(token);

  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const normalizedStatus = normalizeOrderStatus(order.status);

  if (!REQUESTABLE_FROM.has(normalizedStatus)) {
    return NextResponse.json({ ok: false, reason: "ORDER_NOT_ELIGIBLE" }, { status: 409 });
  }

  const receivedAt = new Date();

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: "processing",
        lastInboundEmailAt: receivedAt,
        needsEmailAttention: true,
        unreadInboundEmailCount: { increment: 1 },
      },
    }),
    prisma.orderEmailMessage.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        direction: "INBOUND",
        status: "RECEIVED",
        subject: "Ønsker endring av bestilling",
        bodyText: message,
        fromEmail: order.email || "unknown@customer",
        fromName: order.customerName ?? order.customerLabel ?? null,
        toEmail: getGmailSendAsEmail(),
        receivedAt,
      },
    }),
  ]);

  await createOrderStatusChangedEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: { source: "SYSTEM", name: "Customer" },
    fromStatus: order.status,
    toStatus: "processing",
    note: "Customer requested a change via the emailed action link.",
  });

  return NextResponse.json({ ok: true });
}
