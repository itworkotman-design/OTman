import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/sendEmail";
import {
  buildOrderConversationEmailHtml,
  buildReplyToAddress,
  buildThreadedSubject,
  createOrderEmailThreadToken,
} from "@/lib/orders/orderEmail";

type OrderEmailRouteParams = {
  params: Promise<{
    orderId: string;
  }>;
};

type SendOrderEmailBody = {
  to?: unknown;
  recipientName?: unknown;
  subject?: unknown;
  message?: unknown;
};

async function getAdminMembership(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return {
      session: null,
      membership: null,
      response: NextResponse.json(
        { ok: false, reason: "UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }

  if (!session.activeCompanyId) {
    return {
      session,
      membership: null,
      response: NextResponse.json(
        { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
        { status: 409 },
      ),
    };
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
    },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return {
      session,
      membership: null,
      response: NextResponse.json(
        { ok: false, reason: "FORBIDDEN" },
        { status: 403 },
      ),
    };
  }

  return {
    companyId: session.activeCompanyId,
    session,
    membership,
    response: null,
  };
}

function getTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: Request, { params }: OrderEmailRouteParams) {
  const auth = await getAdminMembership(req);

  if (auth.response || !auth.session) {
    return auth.response;
  }

  const companyId = auth.companyId;

  if (!companyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId,
    },
    select: {
      id: true,
      emailThreadToken: true,
      needsEmailAttention: true,
      unreadInboundEmailCount: true,
      lastInboundEmailAt: true,
      lastOutboundEmailAt: true,
    },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const messages = await prisma.orderEmailMessage.findMany({
    where: {
      orderId,
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      sentByMembership: {
        select: {
          user: {
            select: {
              username: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    conversation: {
      threadToken: order.emailThreadToken ?? "",
      needsEmailAttention: order.needsEmailAttention,
      unreadInboundEmailCount: order.unreadInboundEmailCount,
      lastInboundEmailAt: order.lastInboundEmailAt,
      lastOutboundEmailAt: order.lastOutboundEmailAt,
      messages: messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        status: message.status,
        subject: message.subject,
        bodyText: message.bodyText ?? "",
        bodyHtml: message.bodyHtml ?? "",
        fromEmail: message.fromEmail,
        fromName: message.fromName ?? "",
        toEmail: message.toEmail,
        toName: message.toName ?? "",
        createdAt: message.createdAt,
        sentAt: message.sentAt,
        receivedAt: message.receivedAt,
        sentByName:
          message.sentByMembership?.user.username ||
          message.sentByMembership?.user.email ||
          "",
        sentByEmail: message.sentByMembership?.user.email || "",
      })),
    },
  });
}

export async function POST(req: Request, { params }: OrderEmailRouteParams) {
  const auth = await getAdminMembership(req);

  if (auth.response || !auth.session || !auth.membership) {
    return auth.response;
  }

  const companyId = auth.companyId;

  if (!companyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const { orderId } = await params;
  const body = (await req.json().catch(() => null)) as SendOrderEmailBody | null;

  const to = getTrimmedString(body?.to);
  const recipientName = getTrimmedString(body?.recipientName);
  const subject = getTrimmedString(body?.subject);
  const message = getTrimmedString(body?.message);

  if (!to) {
    return NextResponse.json(
      { ok: false, reason: "MISSING_RECIPIENT" },
      { status: 400 },
    );
  }

  if (!subject) {
    return NextResponse.json(
      { ok: false, reason: "MISSING_SUBJECT" },
      { status: 400 },
    );
  }

  if (!message) {
    return NextResponse.json(
      { ok: false, reason: "MISSING_MESSAGE" },
      { status: 400 },
    );
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId,
    },
    select: {
      id: true,
      companyId: true,
      displayId: true,
      orderNumber: true,
      customerName: true,
      customerLabel: true,
      emailThreadToken: true,
    },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const threadToken = order.emailThreadToken || createOrderEmailThreadToken();
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "bestilling@otman.no";
  const senderName = process.env.BREVO_SENDER_NAME || "Otman Transport";

  if (!order.emailThreadToken) {
    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        emailThreadToken: threadToken,
      },
    });
  }

  const orderLabel =
    order.orderNumber && order.orderNumber.trim().length > 0
      ? `Order ${order.displayId} | ${order.orderNumber}`
      : `Order ${order.displayId}`;
  const finalSubject = buildThreadedSubject(subject, threadToken);
  const replyToEmail = buildReplyToAddress(threadToken);

  try {
    const sendResult = await sendEmail({
      to: {
        email: to,
        name: recipientName || order.customerName || order.customerLabel || to,
      },
      subject: finalSubject,
      html: buildOrderConversationEmailHtml({
        messageText: message,
        orderLabel,
      }),
      replyTo: replyToEmail
        ? {
            email: replyToEmail,
            name: senderName,
          }
        : null,
    });

    const sentAt = new Date();

    const savedMessage = await prisma.orderEmailMessage.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        direction: "OUTBOUND",
        status: "SENT",
        sentByMembershipId: auth.membership.id,
        externalMessageId: sendResult.messageId,
        subject: finalSubject,
        bodyText: message,
        bodyHtml: buildOrderConversationEmailHtml({
          messageText: message,
          orderLabel,
        }),
        fromEmail: senderEmail,
        fromName: senderName,
        toEmail: to,
        toName: recipientName || order.customerName || order.customerLabel || null,
        sentAt,
      },
    });

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        lastOutboundEmailAt: sentAt,
        needsEmailAttention: false,
        unreadInboundEmailCount: 0,
      },
    });

    return NextResponse.json({
      ok: true,
      message: {
        id: savedMessage.id,
      },
    });
  } catch (error) {
    const failedAt = new Date();
    const reason =
      error instanceof Error && error.message
        ? error.message
        : "FAILED_TO_SEND_EMAIL";

    await prisma.orderEmailMessage.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        direction: "OUTBOUND",
        status: "FAILED",
        sentByMembershipId: auth.membership.id,
        subject: finalSubject,
        bodyText: message,
        bodyHtml: buildOrderConversationEmailHtml({
          messageText: message,
          orderLabel,
        }),
        fromEmail: senderEmail,
        fromName: senderName,
        toEmail: to,
        toName: recipientName || order.customerName || order.customerLabel || null,
        sentAt: failedAt,
      },
    });

    return NextResponse.json(
      { ok: false, reason },
      { status: 502 },
    );
  }
}
