import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  extractThreadTokenFromRecipients,
  extractThreadTokenFromSubject,
  parseEmailAddress,
} from "@/lib/orders/orderEmail";

type InboundEmailBody = {
  subject?: unknown;
  text?: unknown;
  html?: unknown;
  messageId?: unknown;
  threadToken?: unknown;
  from?: unknown;
  sender?: unknown;
  to?: unknown;
  recipients?: unknown;
};

function getTextValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function parseInboundEmailBody(
  req: Request,
): Promise<InboundEmailBody | null> {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const form = await req.formData().catch(() => null);

    if (!form) {
      return null;
    }

    const from = String(
      form.get("From") ?? form.get("sender") ?? form.get("from") ?? "",
    );
    const to = String(
      form.get("recipient") ?? form.get("To") ?? form.get("to") ?? "",
    );
    const subject = String(form.get("subject") ?? form.get("Subject") ?? "");
    const text = String(
      form.get("body-plain") ??
        form.get("stripped-text") ??
        form.get("body_plain") ??
        "",
    );
    const html = String(
      form.get("body-html") ??
        form.get("stripped-html") ??
        form.get("body_html") ??
        "",
    );
    const messageId = String(
      form.get("Message-Id") ??
        form.get("message-id") ??
        form.get("Message-ID") ??
        "",
    );

    if (!from || !to) {
      return null;
    }

    return {
      from,
      to,
      subject,
      text,
      html,
      messageId,
    };
  }

  return (await req.json().catch(() => null)) as InboundEmailBody | null;
}

export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  const expected = process.env.EMAIL_INBOUND_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 406 },
    );
  }

  const body = await parseInboundEmailBody(req);

  if (!body) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_PAYLOAD" },
      { status: 406 },
    );
  }

  const subject = getTextValue(body.subject);
  const bodyText = getTextValue(body.text);
  const bodyHtml = getTextValue(body.html);
  const explicitThreadToken = getTextValue(body.threadToken).toLowerCase();
  const threadToken =
    explicitThreadToken ||
    extractThreadTokenFromSubject(subject) ||
    extractThreadTokenFromRecipients(body.to) ||
    extractThreadTokenFromRecipients(body.recipients);

  if (!threadToken) {
    return NextResponse.json(
      { ok: false, reason: "THREAD_TOKEN_NOT_FOUND" },
      { status: 406 },
    );
  }

  const sender =
    parseEmailAddress(body.from) || parseEmailAddress(body.sender);

  if (!sender) {
    return NextResponse.json(
      { ok: false, reason: "SENDER_NOT_FOUND" },
      { status: 406 },
    );
  }

  const primaryRecipient =
    parseEmailAddress(body.to) || parseEmailAddress(body.recipients);

  const order = await prisma.order.findFirst({
    where: {
      emailThreadToken: threadToken,
    },
    select: {
      id: true,
      companyId: true,
    },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, reason: "ORDER_NOT_FOUND" },
      { status: 406 },
    );
  }

  const receivedAt = new Date();
  const defaultRecipientEmail =
    process.env.BREVO_SENDER_EMAIL || "bestilling@otman.no";
  const defaultRecipientName =
    process.env.BREVO_SENDER_NAME || "Otman Transport";

  await prisma.orderEmailMessage.create({
    data: {
      orderId: order.id,
      companyId: order.companyId,
      direction: "INBOUND",
      status: "RECEIVED",
      externalMessageId: getTextValue(body.messageId) || null,
      subject: subject || "Inbound email",
      bodyText: bodyText || null,
      bodyHtml: bodyHtml || null,
      fromEmail: sender.email,
      fromName: sender.name ?? null,
      toEmail: primaryRecipient?.email || defaultRecipientEmail,
      toName: primaryRecipient?.name ?? defaultRecipientName,
      receivedAt,
    },
  });

  await prisma.order.update({
    where: {
      id: order.id,
    },
    data: {
      lastInboundEmailAt: receivedAt,
      needsEmailAttention: true,
      unreadInboundEmailCount: {
        increment: 1,
      },
    },
  });

  return NextResponse.json({
    ok: true,
  });
}
