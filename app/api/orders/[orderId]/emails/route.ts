import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/sendEmail";
import { sendGmailEmail } from "@/lib/email/sendGmailEmail";
import {
  buildOrderConversationEmailHtml,
  buildOrderConversationEmailText,
  buildReplySubject,
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
  additionalTo?: unknown;
  additionalRecipientName?: unknown;
  subject?: unknown;
  message?: unknown;
};

async function getAdminMembership(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return {
      session: null,
      membership: null,
      response: NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  if (!session.activeCompanyId) {
    return {
      session,
      membership: null,
      response: NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 }),
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
      company: {
        select: {
          orderEmailsEnabled: true,
        },
      },
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
      response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }),
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

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

function formatReplyTimestamp(value: Date) {
  return value.toLocaleString("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function stripHtmlToPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function formatEmailPerson(name: string | null, email: string) {
  if (name && name.trim()) {
    return `${name.trim()} <${email}>`;
  }

  return email;
}

function buildFailedConversationBody(message: string, reason: string) {
  const sections = ["Email failed to send.", `Reason: ${reason}`];

  if (message) {
    sections.push("", "Original message:", message);
  }

  return sections.join("\n");
}

export async function GET(req: Request, { params }: OrderEmailRouteParams) {
  const auth = await getAdminMembership(req);

  if (auth.response || !auth.session) {
    return auth.response;
  }

  const companyId = auth.companyId;

  if (!companyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId,
    },
    select: {
      id: true,
      customerName: true,
      customerLabel: true,
      email: true,

      createdByMembership: {
        select: {
          user: {
            select: {
              username: true,
              email: true,
            },
          },
        },
      },

      emailThreadToken: true,
      needsEmailAttention: true,
      unreadInboundEmailCount: true,
      lastInboundEmailAt: true,
      lastOutboundEmailAt: true,
    },
  });

  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
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
      defaultRecipientEmail: order.createdByMembership?.user.email || order.email || "",
      defaultRecipientName: order.createdByMembership?.user.username || order.createdByMembership?.user.email || order.customerLabel || "",
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
        sentByName: message.sentByMembership?.user.username || message.sentByMembership?.user.email || "",
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

  if (auth.membership.company?.orderEmailsEnabled === false) {
    return NextResponse.json({ ok: false, reason: "ORDER_EMAILS_DISABLED" }, { status: 409 });
  }

  const companyId = auth.companyId;

  if (!companyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const { orderId } = await params;
  const body = (await req.json().catch(() => null)) as SendOrderEmailBody | null;

  const typedTo = getTrimmedString(body?.to);
  const typedRecipientName = getTrimmedString(body?.recipientName);
  const additionalTo = "";
  const additionalRecipientName = "";
  const subject = getTrimmedString(body?.subject);
  const message = getTrimmedString(body?.message);

  if (!subject) {
    return NextResponse.json({ ok: false, reason: "MISSING_SUBJECT" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ ok: false, reason: "MISSING_MESSAGE" }, { status: 400 });
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
      email: true,
      emailThreadToken: true,
    },
  });

  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const primaryRecipientEmail = typedTo || order.email?.trim() || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryRecipientEmail)) {
    return NextResponse.json({ ok: false, reason: "INVALID_RECIPIENT_EMAIL" }, { status: 400 });
  }
  const primaryRecipientName = typedRecipientName || order.customerName?.trim() || order.customerLabel?.trim() || "";

  if (!primaryRecipientEmail) {
    return NextResponse.json({ ok: false, reason: "MISSING_RECIPIENT" }, { status: 400 });
  }

  const recipients = [
    {
      email: primaryRecipientEmail,
      name: primaryRecipientName || primaryRecipientEmail,
    },
    ...(additionalTo
      ? [
          {
            email: additionalTo,
            name: additionalRecipientName || additionalTo,
          },
        ]
      : []),
  ];
  const backupEmail = getTrimmedString(process.env.ORDER_CONVERSATION_BACKUP_EMAIL) || "itworkotman@gmail.com";
  const normalizedRecipientEmails = new Set(recipients.map((recipient) => normalizeEmailAddress(recipient.email)));
  const backupRecipient = backupEmail
    ? {
        email: backupEmail,
        name: "OTman Backup",
      }
    : null;
  const storedToEmail = recipients.map((recipient) => recipient.email).join(", ");
  const storedToName = recipients.map((recipient) => recipient.name || recipient.email).join(", ");

  const existingMessages = await prisma.orderEmailMessage.findMany({
    where: {
      orderId: order.id,
      companyId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      direction: true,
      externalMessageId: true,
      subject: true,
      bodyText: true,
      bodyHtml: true,
      fromEmail: true,
      fromName: true,
      createdAt: true,
    },
  });

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

  const orderLabel = order.orderNumber && order.orderNumber.trim().length > 0 ? `Order ${order.displayId} | ${order.orderNumber}` : `Order ${order.displayId}`;
  const hasExistingConversation = existingMessages.length > 0;
  const baseSubject = hasExistingConversation ? buildReplySubject(subject) : subject;
  const finalSubject = baseSubject;
  const replyToEmail = buildReplyToAddress(threadToken);
  const replyAnchor = existingMessages.find(
    (item) => item.direction === "OUTBOUND" && typeof item.externalMessageId === "string" && item.externalMessageId.trim().length > 0,
  );
  const references = existingMessages
    .map((item) => (typeof item.externalMessageId === "string" ? item.externalMessageId.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(-10);
  const replyContext = null;
  const emailHtml = buildOrderConversationEmailHtml({
    messageText: message,
    orderLabel,
    threadToken,
    replyContext,
  });
  const emailText = buildOrderConversationEmailText({
    messageText: message,
    orderLabel,
    replyContext,
  });
  const emailHeaders: Record<string, string> = {};

  if (replyAnchor?.externalMessageId) {
    emailHeaders["In-Reply-To"] = replyAnchor.externalMessageId;
  }

  if (references.length > 0) {
    emailHeaders.References = references.join(" ");
  }

  try {
    console.log("EMAIL THREAD DEBUG", {
      hasExistingConversation,
      replyAnchor,
      references,
      emailHeaders,
    });

    const sendResult = await sendGmailEmail({
      to: recipients[0],
      subject: finalSubject,
      html: emailHtml,
      text: emailText,
      replyTo: replyToEmail || undefined,
      inReplyTo: replyAnchor?.externalMessageId || undefined,
      references,
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
        bodyHtml: emailHtml,
        fromEmail: senderEmail,
        fromName: senderName,
        toEmail: storedToEmail,
        toName: storedToName || null,
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
    const reason = error instanceof Error && error.message ? error.message : "FAILED_TO_SEND_EMAIL";
    const failedBodyText = buildFailedConversationBody(message, reason);
    const failedBodyHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
        <p style="margin:0 0 16px 0;font-weight:700;color:#b91c1c;">
          Email failed to send.
        </p>
        <p style="margin:0 0 16px 0;">
          Reason: ${escapeHtml(reason)}
        </p>
        ${message ? `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(message)}</p>` : ""}
      </div>
    `;

    await prisma.orderEmailMessage.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        direction: "OUTBOUND",
        status: "FAILED",
        sentByMembershipId: auth.membership.id,
        subject: finalSubject,
        bodyText: failedBodyText,
        bodyHtml: failedBodyHtml,
        fromEmail: senderEmail,
        fromName: senderName,
        toEmail: storedToEmail,
        toName: storedToName || null,
        sentAt: failedAt,
      },
    });

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        lastOutboundEmailAt: failedAt,
        needsEmailAttention: true,
      },
    });

    return NextResponse.json({ ok: false, reason }, { status: 502 });
  }
}

export async function PATCH(req: Request, { params }: OrderEmailRouteParams) {
  const auth = await getAdminMembership(req);

  if (auth.response || !auth.session) {
    return auth.response;
  }

  const companyId = auth.companyId;

  if (!companyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId,
    },
    select: {
      id: true,
    },
  });

  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.order.update({
    where: {
      id: order.id,
    },
    data: {
      needsEmailAttention: false,
      unreadInboundEmailCount: 0,
    },
  });

  return NextResponse.json({
    ok: true,
  });
}
