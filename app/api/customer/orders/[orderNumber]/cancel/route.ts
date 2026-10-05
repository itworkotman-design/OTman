import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCustomerSession } from "@/lib/customerAccounts/customerSession";
import { findCustomerOrder } from "@/lib/customerAccounts/customerOrderView";
import { getCustomerEditPermissions } from "@/lib/orders/customerOrderEditPolicy";
import { createOrderActionEvent, createOrderStatusChangedEvent } from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { findCancelledOrderPartner } from "@/lib/orders/cancelledOrderPartner";
import { isPartnerTrackedOrder } from "@/lib/orders/partnerRequirement";
import { getGmailSendAsEmail } from "@/lib/email/gmailAccounts";
import { validateTextField } from "@/lib/orders/websiteOrderValidation";

// "Cancel" in My order. More than 24h before the time window the order is
// cancelled straight away (like the emailed cancel link,
// app/api/public/orders/[token]/cancel); after that the crew may already be
// planned, so it only becomes a request — logged in the order's Email Center
// thread, with a staff alert — and staff decide.

type Params = { params: Promise<{ orderNumber: string }> };

const ACTOR = { source: "SYSTEM", name: "Customer" } as const;

export async function POST(req: Request, { params }: Params) {
  const session = await getCustomerSession(req);
  if (!session) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });

  const { orderNumber } = await params;
  const order = await findCustomerOrder(session.accountId, decodeURIComponent(orderNumber));
  if (!order) return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (message && validateTextField(message)) {
    return NextResponse.json({ ok: false, reason: "INVALID_MESSAGE" }, { status: 422 });
  }

  const now = new Date();
  const permissions = getCustomerEditPermissions(order, now);
  if (!permissions.open) return NextResponse.json({ ok: false, reason: "ORDER_CLOSED" }, { status: 409 });

  const reference = order.orderNumber ?? String(order.displayId);

  if (permissions.beforeCutoff) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "cancelled", statusChangedAt: now } });

    // Fill the configured placeholder partner, but only if the order has none
    // (same conditional write as the emailed cancel link).
    const cancelledPartner = isPartnerTrackedOrder(order.displayId) ? await findCancelledOrderPartner(prisma, order.companyId) : null;
    if (cancelledPartner) {
      await prisma.order.updateMany({
        where: { id: order.id, subcontractorMembershipId: null, OR: [{ subcontractor: null }, { subcontractor: "" }] },
        data: cancelledPartner,
      });
    }

    await createOrderStatusChangedEvent(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      actor: ACTOR,
      fromStatus: order.status,
      toStatus: "cancelled",
      note: message ? `Customer cancelled the order in My order: ${message}` : "Customer cancelled the order in My order.",
    });
    await createOrderNotification(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      type: "MANUAL_REVIEW",
      title: `Customer cancelled order #${reference}`,
      message: message ? `The customer cancelled the order themselves: "${message}"` : "The customer cancelled the order themselves.",
    });

    return NextResponse.json({ ok: true, mode: "cancelled" });
  }

  const receivedAt = now;
  const text = ["Kunden ønsker å kansellere bestillingen (mindre enn 24 timer før oppdraget).", message].filter(Boolean).join("\n\n");
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { lastInboundEmailAt: receivedAt, needsEmailAttention: true, unreadInboundEmailCount: { increment: 1 } },
    }),
    prisma.orderEmailMessage.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        direction: "INBOUND",
        status: "RECEIVED",
        subject: "Ønsker å kansellere bestillingen",
        bodyText: text,
        fromEmail: order.email || "unknown@customer",
        fromName: order.customerName ?? order.customerLabel ?? null,
        toEmail: getGmailSendAsEmail(),
        receivedAt,
      },
    }),
  ]);
  await createOrderActionEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: ACTOR,
    title: "Customer asked to cancel (inside 24h)",
    details: message ? [message] : [],
  });
  await createOrderNotification(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    type: "MANUAL_REVIEW",
    title: `Customer wants to cancel order #${reference}`,
    message: `The customer asked to cancel less than 24h before the job — contact them and decide.${message ? ` Their message: "${message}"` : ""}`,
  });

  return NextResponse.json({ ok: true, mode: "requested" });
}
