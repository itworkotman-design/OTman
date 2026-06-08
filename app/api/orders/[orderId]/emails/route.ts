import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getGmailErrorDebug, isGmailOAuthScopeMissing, REQUIRED_GMAIL_SCOPES, sendGmailEmail } from "@/lib/email/sendGmailEmail";
import { getAdminEmails, getGmailAccountEmail, getGmailSendAsEmail } from "@/lib/email/gmailAccounts";
import {
  buildOrderConversationEmailHtml,
  buildOrderConversationEmailText,
  buildReplySubject,
  buildReplyToAddress,
  createOrderEmailThreadToken,
  getInitialAppMessageQuoteContext,
  stripThreadTokenMarkers,
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
      customerMembership: {
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

  const latestSentOutbound = messages.find(
    (message) =>
      message.direction === "OUTBOUND" &&
      (message.status === "SENT" ||
        message.status === "SENT_WITH_SYNC_WARNING") &&
      message.toEmail.trim().length > 0,
  );
  const linkedAccountUser = order.customerMembership?.user;
  const createdByUser = order.createdByMembership?.user;
  const defaultRecipientEmail =
    latestSentOutbound?.toEmail.trim() ||
    linkedAccountUser?.email.trim() ||
    order.email?.trim() ||
    createdByUser?.email.trim() ||
    "";
  const defaultRecipientName =
    latestSentOutbound?.toName?.trim() ||
    linkedAccountUser?.username?.trim() ||
    linkedAccountUser?.email.trim() ||
    order.customerLabel?.trim() ||
    order.customerName?.trim() ||
    createdByUser?.username?.trim() ||
    createdByUser?.email.trim() ||
    "";

  return NextResponse.json({
    ok: true,
    conversation: {
      defaultRecipientEmail,
      defaultRecipientName,
      threadToken: order.emailThreadToken ?? "",
      needsEmailAttention: order.needsEmailAttention,
      unreadInboundEmailCount: order.unreadInboundEmailCount,
      lastInboundEmailAt: order.lastInboundEmailAt,
      lastOutboundEmailAt: order.lastOutboundEmailAt,
      messages: messages.map((message) => ({
        id: message.id,
        source: message.source,
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
  const subject = stripThreadTokenMarkers(getTrimmedString(body?.subject));
  const message = stripThreadTokenMarkers(getTrimmedString(body?.message));

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
      customerMembership: {
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

  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const creatorUser = order.customerMembership?.user ?? order.createdByMembership.user;
  const senderAccount = getGmailSendAsEmail();
  const backupEmail = process.env.ORDER_CONVERSATION_BACKUP_EMAIL?.trim() || "";
  const notificationEmail = process.env.ORDER_NOTIFICATION_EMAIL?.trim() || "";
  const disallowedToEmails = new Set(
    [...getAdminEmails(), backupEmail.trim().toLowerCase(), notificationEmail.trim().toLowerCase()]
      .filter((email) => email.length > 0),
  );
  const recipientCandidates = [
    typedTo,
    order.email?.trim() ?? "",
    order.customerMembership?.user.email?.trim() ?? "",
    creatorUser.email.trim(),
  ].filter((email) => email.length > 0);
  const primaryRecipientEmail = recipientCandidates.find((email) => !disallowedToEmails.has(email.trim().toLowerCase())) ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryRecipientEmail)) {
    return NextResponse.json({ ok: false, reason: "INVALID_RECIPIENT_EMAIL" }, { status: 400 });
  }

  const primaryRecipientName =
    typedRecipientName || order.customerName?.trim() || order.customerLabel?.trim() || creatorUser.username?.trim() || creatorUser.email.trim() || "";

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
      source: true,
      externalMessageId: true,
      subject: true,
      bodyText: true,
      bodyHtml: true,
      gmailThreadId: true,
      fromEmail: true,
      fromName: true,
      toEmail: true,
      toName: true,
      createdAt: true,
    },
  });

  const threadToken = order.emailThreadToken || createOrderEmailThreadToken();
  const senderEmail = senderAccount;
  const senderName = process.env.BREVO_SENDER_NAME || "Otman";

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
  const replyToEmail = buildReplyToAddress(threadToken);
  const existingGmailThreadId =
    existingMessages.find((item) => typeof item.gmailThreadId === "string" && item.gmailThreadId.trim().length > 0)?.gmailThreadId?.trim() ?? null;
  const replyAnchor = existingMessages.find(
    (item) => item.direction === "OUTBOUND" && typeof item.externalMessageId === "string" && item.externalMessageId.trim().length > 0,
  );
  const references = replyAnchor
    ? existingMessages
        .map((item) => (typeof item.externalMessageId === "string" ? item.externalMessageId.trim() : ""))
        .filter((item) => item.length > 0)
        .slice(-10)
    : [];
  const finalSubject = baseSubject;
  const replyContext = getInitialAppMessageQuoteContext(existingMessages);

  const emailHtml = buildOrderConversationEmailHtml({
    messageText: message,
    orderLabel,
    threadToken,
    replyContext,
  });
  const emailText = buildOrderConversationEmailText({
    messageText: message,
    orderLabel,
    threadToken,
    replyContext,
  });
  const emailHeaders: Record<string, string> = {};

  if (replyAnchor?.externalMessageId) {
    emailHeaders["In-Reply-To"] = replyAnchor.externalMessageId;
  }

  if (references.length > 0) {
    emailHeaders.References = references.join(" ");
  }

  console.log("ORDER EMAIL SEND DEBUG", {
    senderAccount,
    oauthAccountEmail: getGmailAccountEmail(),
    to: recipients.map((recipient) => recipient.email),
    cc: [],
    bcc: backupEmail ? [backupEmail] : [],
    replyTo: replyToEmail,
    emailThreadToken: threadToken,
    existingGmailThreadId,
    hasExistingConversation,
    replyAnchor,
    references,
    emailHeaders,
  });

  let sendResult: Awaited<ReturnType<typeof sendGmailEmail>>;

  try {
    sendResult = await sendGmailEmail({
      to: recipients[0],
      bcc: backupEmail || undefined,
      threadToken,
      subject: finalSubject,
      html: emailHtml,
      text: emailText,
      replyTo: replyToEmail || undefined,
      inReplyTo: replyAnchor?.externalMessageId || undefined,
      references,
      gmailThreadId: existingGmailThreadId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      direction: "outbound",
    });
  } catch (error) {
    const errorDebug = getGmailErrorDebug(error);
    console.error("ORDER EMAIL SEND FAILED BEFORE GMAIL SUCCESS", errorDebug);
    const failedAt = new Date();
    const scopeMissing = isGmailOAuthScopeMissing(error);
    const reason = scopeMissing ? "GMAIL_OAUTH_SCOPE_MISSING" : error instanceof Error && error.message ? error.message : "FAILED_TO_SEND_EMAIL";
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
        source: "APP",
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

    return NextResponse.json(
      {
        ok: false,
        reason,
        gmailError: {
          message: errorDebug.message,
          code: errorDebug.code,
          status: errorDebug.status,
          responseData: errorDebug.responseData,
        },
        requiredScopes: scopeMissing ? REQUIRED_GMAIL_SCOPES : undefined,
      },
      { status: 502 },
    );
  }

  console.log("ORDER EMAIL GMAIL SEND RESULT", {
    emailThreadToken: threadToken,
    oauthAccountEmail: sendResult.oauthAccountEmail,
    gmailMessageId: sendResult.gmailMessageId,
    gmailThreadId: sendResult.gmailThreadId,
    externalMessageId: sendResult.messageId,
    syncWarning: sendResult.syncWarning,
  });

  const sentAt = new Date();
  const storedGmailThreadId = existingGmailThreadId || sendResult.gmailThreadId;
  let savedMessage: { id: string };

  try {
    console.log("ORDER EMAIL BEFORE prisma.orderEmailMessage.create", {
      orderId: order.id,
      companyId: order.companyId,
      status: sendResult.syncWarning ? "SENT_WITH_SYNC_WARNING" : "SENT",
      source: "GMAIL",
      externalMessageId: sendResult.messageId,
      gmailMessageId: sendResult.gmailMessageId,
      gmailThreadId: storedGmailThreadId,
    });
    savedMessage = await prisma.orderEmailMessage.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        direction: "OUTBOUND",
        status: sendResult.syncWarning ? "SENT_WITH_SYNC_WARNING" : "SENT",
        source: "GMAIL",
        sentByMembershipId: auth.membership.id,
        externalMessageId: sendResult.messageId,
        gmailMessageId: sendResult.gmailMessageId,
        gmailThreadId: storedGmailThreadId,
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

    console.log("ORDER EMAIL BEFORE prisma.order.update", {
      orderId: order.id,
      lastOutboundEmailAt: sentAt,
      needsEmailAttention: false,
      unreadInboundEmailCount: 0,
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
  } catch (error) {
    console.error("ORDER EMAIL POST-GMAIL PRISMA PERSIST FAILED", getGmailErrorDebug(error));
    throw error;
  }

  console.log("ORDER EMAIL BEFORE returning response", {
    orderId: order.id,
    messageId: savedMessage.id,
    gmailMessageId: sendResult.gmailMessageId,
    gmailThreadId: storedGmailThreadId,
    externalMessageId: sendResult.messageId,
    status: sendResult.syncWarning ? "SENT_WITH_SYNC_WARNING" : "SENT",
  });

  return NextResponse.json({
    ok: true,
    message: {
      id: savedMessage.id,
    },
  });
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
