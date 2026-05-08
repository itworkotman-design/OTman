import { google, type gmail_v1 } from "googleapis";
import { prisma } from "@/lib/db";
import { getAdminEmails, getGmailAccountEmail, getGmailSendAsEmail, normalizeEmail } from "@/lib/email/gmailAccounts";
import { extractThreadTokenFromRecipients, parseEmailAddress } from "@/lib/orders/orderEmail";

const OTMAN_THREAD_TOKEN_REGEX = /\[OTMAN:([a-zA-Z0-9_-]+)\]/;
const DEFAULT_SEARCH_QUERY = 'newer_than:30d (to:reply.otman.no OR cc:reply.otman.no OR "[OTMAN:")';
const DEFAULT_MAX_RESULTS = 50;

type GmailSyncResult = {
  imported: number;
  skippedDuplicates: number;
  tokenNotFound: number;
  orderNotFound: number;
};

type ParsedGmailMessage = {
  externalMessageId: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  toName: string | null;
  sentAt: Date;
  token: string | null;
};

function decodeBase64Url(value: string | null | undefined) {
  if (!value) return "";

  return Buffer.from(
    value.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
) {
  return (
    headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())
      ?.value?.trim() ?? ""
  );
}

function collectMessageBodies(
  part: gmail_v1.Schema$MessagePart | undefined,
): { textParts: string[]; htmlParts: string[] } {
  const textParts: string[] = [];
  const htmlParts: string[] = [];

  if (!part) {
    return { textParts, htmlParts };
  }

  const decoded = decodeBase64Url(part.body?.data);

  if (decoded) {
    if (part.mimeType === "text/plain") {
      textParts.push(decoded);
    } else if (part.mimeType === "text/html") {
      htmlParts.push(decoded);
    }
  }

  for (const childPart of part.parts ?? []) {
    const childBodies = collectMessageBodies(childPart);
    textParts.push(...childBodies.textParts);
    htmlParts.push(...childBodies.htmlParts);
  }

  return { textParts, htmlParts };
}

function extractThreadToken(...values: string[]) {
  for (const value of values) {
    const match = value.match(OTMAN_THREAD_TOKEN_REGEX);
    const token = match?.[1]?.trim();

    if (token) {
      return token;
    }
  }

  return null;
}

function parseGmailDate(value: string) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parseGmailMessage(
  message: gmail_v1.Schema$Message,
): ParsedGmailMessage | null {
  const externalMessageId = message.id?.trim();

  if (!externalMessageId) {
    return null;
  }

  const payload = message.payload;
  const headers = payload?.headers;
  const subject = getHeader(headers, "Subject") || "Gmail message";
  const from = parseEmailAddress(getHeader(headers, "From"));
  const toHeader = getHeader(headers, "To");
  const ccHeader = getHeader(headers, "Cc");
  const to = parseEmailAddress(toHeader);
  const sentAt = parseGmailDate(getHeader(headers, "Date"));
  const bodies = collectMessageBodies(payload);
  const bodyText = bodies.textParts.join("\n\n").trim();
  const bodyHtml = bodies.htmlParts.join("\n\n").trim();
  const snippet = message.snippet?.trim() ?? "";

  if (!from) {
    return null;
  }

  return {
    externalMessageId,
    subject,
    bodyText: bodyText || snippet,
    bodyHtml,
    fromEmail: from.email,
    fromName: from.name ?? null,
    toEmail: to?.email ?? getGmailAccountEmail(),
    toName: to?.name ?? null,
    sentAt,
    token: extractThreadTokenFromRecipients(toHeader) || extractThreadTokenFromRecipients(ccHeader) || extractThreadToken(subject, bodyText, bodyHtml, snippet),
  };
}

function createGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

function isAdminSender(email: string) {
  return getAdminEmails().includes(email.toLowerCase());
}

export async function syncGmailOrderConversations(options?: {
  maxResults?: number;
  query?: string;
}): Promise<GmailSyncResult> {
  const gmail = createGmailClient();
  const gmailUserId = getGmailAccountEmail() || "me";
  let oauthAccountEmail = "";
  let sendAsAliases: string[] = [];

  try {
    const profile = await gmail.users.getProfile({
      userId: "me",
    });
    oauthAccountEmail = profile.data.emailAddress ?? "";
  } catch (error) {
    console.warn("GMAIL SYNC PROFILE LOOKUP FAILED", {
      configuredAccountEmail: getGmailAccountEmail(),
      configuredSendAsEmail: getGmailSendAsEmail(),
      reason: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    });
  }

  try {
    const sendAsResponse = await gmail.users.settings.sendAs.list({
      userId: gmailUserId,
    });
    sendAsAliases = (sendAsResponse.data.sendAs ?? []).map((alias) => normalizeEmail(alias.sendAsEmail)).filter((alias) => alias.length > 0);
  } catch (error) {
    console.warn("GMAIL SYNC SEND AS ALIASES LOOKUP FAILED", {
      oauthAccountEmail,
      configuredAccountEmail: getGmailAccountEmail(),
      configuredSendAsEmail: getGmailSendAsEmail(),
      reason: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    });
  }

  console.log("GMAIL SYNC STARTUP DEBUG", {
    oauthAccountEmail,
    configuredAccountEmail: getGmailAccountEmail(),
    configuredSendAsEmail: getGmailSendAsEmail(),
    sendAsAliases,
  });

  const result: GmailSyncResult = {
    imported: 0,
    skippedDuplicates: 0,
    tokenNotFound: 0,
    orderNotFound: 0,
  };

  const listResponse = await gmail.users.messages.list({
    userId: gmailUserId,
    q: options?.query ?? DEFAULT_SEARCH_QUERY,
    maxResults: options?.maxResults ?? DEFAULT_MAX_RESULTS,
  });

  for (const listedMessage of listResponse.data.messages ?? []) {
    if (!listedMessage.id) continue;

    const messageResponse = await gmail.users.messages.get({
      userId: gmailUserId,
      id: listedMessage.id,
      format: "full",
    });

    const parsed = parseGmailMessage(messageResponse.data);

    if (!parsed?.token) {
      console.log("GMAIL SYNC TOKEN NOT FOUND", {
        externalMessageId: listedMessage.id,
      });
      result.tokenNotFound += 1;
      continue;
    }

    const duplicate = await prisma.orderEmailMessage.findFirst({
      where: {
        externalMessageId: parsed.externalMessageId,
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      console.log("GMAIL SYNC SKIPPED DUPLICATE", {
        externalMessageId: parsed.externalMessageId,
      });
      result.skippedDuplicates += 1;
      continue;
    }

    const order = await prisma.order.findFirst({
      where: {
        emailThreadToken: parsed.token,
      },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (!order) {
      result.orderNotFound += 1;
      continue;
    }

    const adminSender = isAdminSender(parsed.fromEmail);
    const direction = adminSender ? "OUTBOUND" : "INBOUND";
    const timestamp = parsed.sentAt;

    await prisma.orderEmailMessage.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        direction,
        source: "GMAIL",
        status: adminSender ? "SENT" : "RECEIVED",
        externalMessageId: parsed.externalMessageId,
        subject: parsed.subject,
        bodyText: parsed.bodyText || null,
        bodyHtml: parsed.bodyHtml || null,
        fromEmail: parsed.fromEmail,
        fromName: parsed.fromName,
        toEmail: parsed.toEmail,
        toName: parsed.toName,
        sentAt: adminSender ? timestamp : null,
        receivedAt: adminSender ? null : timestamp,
      },
    });

    if (direction === "INBOUND") {
      await prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          needsEmailAttention: true,
          unreadInboundEmailCount: {
            increment: 1,
          },
          lastInboundEmailAt: new Date(),
        },
      });
    } else {
      await prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          lastOutboundEmailAt: timestamp,
        },
      });
    }

    console.log("GMAIL SYNC IMPORTED", {
      externalMessageId: parsed.externalMessageId,
      orderId: order.id,
      direction,
    });
    result.imported += 1;
  }

  return result;
}
