// app/api/orders/send-prepare-email/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canEditOrders } from "@/lib/users/orderAccess";
import { sendGmailEmail } from "@/lib/email/sendGmailEmail";
import type { AppPermission } from "@/lib/users/types";
import { createOrderActionEvent } from "@/lib/orders/orderEvents";
import { PREPARE_ORDERS_EMAIL, type PrepareEmailRecipient } from "@/lib/orders/prepareOrdersEmailGroups";
import { buildSelectedOrdersEmailHtml } from "@/lib/orders/selectedOrdersEmailHtml";

// Sends one "prepare orders" email (one group from prepare-email-groups) to a
// pickup place/store through Gmail. Deliberately kept out of the order email
// conversation:
// - no reply token / thread, so replies stay in the Gmail inbox;
// - no OrderEmailMessage row: the Alert Center treats any message as "a
//   conversation exists" (default recipient, "Re:" subject, first-message
//   notification), and Gmail sync could match a reply through one;
// - lastOutboundEmailAt is never set, so order creators (the stores) don't get
//   an "unread" highlight.
// Instead the order gets prepareEmailSentAt (alerts-column marker) and a
// History entry with the recipients.
export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const companyId = session.activeCompanyId;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, companyId, status: "ACTIVE" },
    select: {
      id: true,
      role: true,
      user: { select: { username: true, email: true } },
      company: { select: { orderEmailsEnabled: true } },
      permissions: { select: { permission: true } },
    },
  });

  const permissions = (membership?.permissions ?? []).map((p): AppPermission => p.permission);

  if (!membership || !canEditOrders(membership.role, permissions)) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  if (membership.company?.orderEmailsEnabled === false) {
    return NextResponse.json({ ok: false, reason: "ORDER_EMAILS_DISABLED" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);

  const orderIds: string[] = Array.isArray(body?.orderIds)
    ? body.orderIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  const recipients: PrepareEmailRecipient[] = Array.isArray(body?.recipients)
    ? body.recipients
        .filter(
          (value: unknown): value is PrepareEmailRecipient =>
            typeof value === "object" &&
            value !== null &&
            typeof (value as { email?: unknown }).email === "string" &&
            (value as { email: string }).email.trim().length > 0,
        )
        .map((recipient: PrepareEmailRecipient) => ({
          email: recipient.email.trim(),
          name: typeof recipient.name === "string" ? recipient.name.trim() || undefined : undefined,
        }))
    : [];

  const recipientName =
    typeof body?.recipientName === "string" && body.recipientName.trim() ? body.recipientName.trim() : "kunde";

  if (orderIds.length === 0) {
    return NextResponse.json({ ok: false, reason: "INVALID_ORDER_IDS" }, { status: 400 });
  }

  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, reason: "MISSING_RECIPIENT" }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, companyId },
    select: {
      id: true,
      displayId: true,
      orderNumber: true,
      deliveryDate: true,
      timeWindow: true,
      customerLabel: true,
      customerName: true,
      phone: true,
      pickupAddress: true,
      extraPickupAddress: true,
      deliveryAddress: true,
      returnAddress: true,
      productsSummary: true,
      cashierName: true,
      priceExVat: true,
      pricingSnapshot: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (orders.length === 0) {
    return NextResponse.json({ ok: false, reason: "NO_ORDERS_FOUND" }, { status: 404 });
  }

  const { subject, message } = PREPARE_ORDERS_EMAIL;
  const html = buildSelectedOrdersEmailHtml({ greetingName: recipientName, message, orders });
  const bodyText = [
    `Hei ${recipientName},`,
    "",
    message,
    "",
    ...orders.map((order) => `Bestilling ID ${order.displayId}${order.productsSummary ? ` – ${order.productsSummary}` : ""}`),
  ].join("\n");
  const toEmail = recipients.map((recipient) => recipient.email).join(", ");
  const orderIdsFound = orders.map((order) => order.id);

  try {
    await sendGmailEmail({ to: recipients, subject, html, text: bodyText });
  } catch (error) {
    const reason = error instanceof Error && error.message ? error.message : "FAILED_TO_SEND_EMAIL";
    // Nothing is written to the orders; the modal shows the reason per email.
    return NextResponse.json({ ok: false, reason }, { status: 502 });
  }

  const sentAt = new Date();

  await prisma.order.updateMany({
    where: { id: { in: orderIdsFound } },
    data: { prepareEmailSentAt: sentAt },
  });

  await Promise.all(
    orders.map((order) =>
      createOrderActionEvent(prisma, {
        orderId: order.id,
        companyId,
        actor: {
          membershipId: membership.id,
          name: membership.user.username ?? null,
          email: membership.user.email,
          source: "USER",
        },
        title: `Order sent for ${subject}`,
        details: [`Recipients: ${toEmail}`],
        createdAt: sentAt,
      }),
    ),
  );

  return NextResponse.json({ ok: true, sentCount: orders.length });
}
