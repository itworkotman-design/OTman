// app/api/orders/send-selected-email/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canEditOrders } from "@/lib/users/orderAccess";
import { sendEmail } from "@/lib/email/sendEmail";
import { getGmailSendAsEmail } from "@/lib/email/gmailAccounts";
import type { AppPermission } from "@/lib/users/types";
import { createOrderActionEvent } from "@/lib/orders/orderEvents";
import { buildSelectedOrdersEmailHtml, escapeHtml } from "@/lib/orders/selectedOrdersEmailHtml";

type EmailRecipient = {
  email: string;
  name?: string;
};

function buildFailedEmailLogBody(message: string, reason: string) {
  const sections = [
    "Selected-order email failed to send.",
    `Reason: ${reason}`,
  ];

  if (message) {
    sections.push("", "Original message:", message);
  }

  return sections.join("\n");
}

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
      user: {
        select: {
          username: true,
          email: true,
        },
      },
      company: {
        select: {
          orderEmailsEnabled: true,
        },
      },
      permissions: {
        select: {
          permission: true,
        },
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const permissions = membership.permissions.map(
    (p): AppPermission => p.permission,
  );

  if (!canEditOrders(membership.role, permissions)) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }
  const activeCompanyId = session.activeCompanyId;

  if (membership.company?.orderEmailsEnabled === false) {
    return NextResponse.json(
      { ok: false, reason: "ORDER_EMAILS_DISABLED" },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => null);

  const orderIds = Array.isArray(body?.orderIds)
    ? body.orderIds.filter(
        (value: unknown): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];

  const recipients = Array.isArray(body?.recipients)
    ? body.recipients.filter(
        (
          value: unknown,
        ): value is EmailRecipient =>
          typeof value === "object" &&
          value !== null &&
          typeof (value as { email?: unknown }).email === "string" &&
          (value as { email: string }).email.trim().length > 0 &&
          (typeof (value as { name?: unknown }).name === "string" ||
            typeof (value as { name?: unknown }).name === "undefined"),
      )
    : [];

  const legacyRecipient =
    typeof body?.to === "string" && body.to.trim().length > 0
      ? {
          email: body.to.trim(),
          name:
            typeof body?.recipientName === "string" &&
            body.recipientName.trim().length > 0
              ? body.recipientName.trim()
              : undefined,
        }
      : null;

  const normalizedRecipients: EmailRecipient[] = (
    recipients.length > 0
      ? recipients
      : legacyRecipient
        ? [legacyRecipient]
        : []
  ).map((recipient: EmailRecipient) => ({
    email: recipient.email.trim(),
    name: recipient.name?.trim() || undefined,
  }));

  const subject =
    typeof body?.subject === "string" && body.subject.trim().length > 0
      ? body.subject.trim()
      : "Valgte bestillinger";

  const message =
    typeof body?.message === "string" && body.message.trim().length > 0
      ? body.message.trim()
      : "";

  if (orderIds.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_ORDER_IDS" },
      { status: 400 },
    );
  }

  if (normalizedRecipients.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "MISSING_RECIPIENT" },
      { status: 400 },
    );
  }

  const orders = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      companyId: session.activeCompanyId,
    },
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
    orderBy: {
      createdAt: "desc",
    },
  });

  if (orders.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "NO_ORDERS_FOUND" },
      { status: 404 },
    );
  }

  const recipientName =
    typeof body?.recipientName === "string" &&
    body.recipientName.trim().length > 0
      ? body.recipientName.trim()
      : "kunde";

  const greetingName = recipientName;
  const htmlBody = buildSelectedOrdersEmailHtml({ greetingName, message, orders });

  try {
    await sendEmail({
      to: normalizedRecipients,
      subject,
      html: htmlBody,
    });

    const sentAt = new Date();
    const actionTitle = `Order sent for ${subject}`;
    const actionDetails = [
      `Recipients: ${normalizedRecipients.map((recipient) => recipient.email).join(", ")}`,
    ];

    await Promise.all(
      orders.map(async (order) => {
        await prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            lastEditedByMembershipId: membership.id,
            lastOutboundEmailAt: sentAt,
          },
        });

        await createOrderActionEvent(prisma, {
          orderId: order.id,
          companyId: activeCompanyId,
          actor: {
            membershipId: membership.id,
            name: membership.user.username ?? null,
            email: membership.user.email,
            source: "USER",
          },
          title: actionTitle,
          details: actionDetails,
          createdAt: sentAt,
        });
      }),
    );

    return NextResponse.json({
      ok: true,
      sentCount: orders.length,
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.message
        ? error.message
        : "FAILED_TO_SEND_EMAIL";
    const failedBodyText = buildFailedEmailLogBody(message, reason);
    const failedBodyHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
        <p style="margin:0 0 16px 0;font-weight:700;color:#b91c1c;">
          Selected-order email failed to send.
        </p>
        <p style="margin:0 0 16px 0;">
          Reason: ${escapeHtml(reason)}
        </p>
        ${
          message
            ? `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(message)}</p>`
            : ""
        }
      </div>
    `;

    await logFailedSelectedOrderEmails({
      orders,
      companyId: session.activeCompanyId,
      membershipId: membership.id,
      subject,
      bodyText: failedBodyText,
      bodyHtml: failedBodyHtml,
      toEmail: normalizedRecipients.map((recipient) => recipient.email).join(", "),
      toName: recipientName || null,
    });

    return NextResponse.json(
      { ok: false, reason },
      { status: 502 },
    );
  }
}

async function logFailedSelectedOrderEmails(params: {
  orders: Array<{
    id: string;
  }>;
  companyId: string;
  membershipId: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  toEmail: string;
  toName: string | null;
}) {
  const failedAt = new Date();

  await Promise.all(
    params.orders.map((order) =>
      prisma.$transaction([
        prisma.orderEmailMessage.create({
          data: {
            orderId: order.id,
            companyId: params.companyId,
            direction: "OUTBOUND",
            status: "FAILED",
            sentByMembershipId: params.membershipId,
            subject: params.subject,
            bodyText: params.bodyText,
            bodyHtml: params.bodyHtml,
            fromEmail: process.env.BREVO_SENDER_EMAIL || getGmailSendAsEmail(),
            fromName: process.env.BREVO_SENDER_NAME || "Otman",
            toEmail: params.toEmail,
            toName: params.toName,
            sentAt: failedAt,
          },
        }),
        prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            lastOutboundEmailAt: failedAt,
            needsEmailAttention: true,
          },
        }),
      ]),
    ),
  );
}
