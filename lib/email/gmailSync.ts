import { google, type gmail_v1 } from "googleapis";
import { prisma } from "@/lib/db";
import { getAdminEmails, getGmailAccountEmail, getGmailSendAsEmail, normalizeEmail } from "@/lib/email/gmailAccounts";
import { extractThreadTokenFromRecipients, parseEmailAddress } from "@/lib/orders/orderEmail";

const OTMAN_THREAD_TOKEN_REGEX = /\[OTMAN:([a-zA-Z0-9_-]+)\]/;
const DEFAULT_INBOUND_SEARCH_QUERY = 'newer_than:30d (to:reply.otman.no OR cc:reply.otman.no OR "[OTMAN:")';
const DEFAULT_SENT_SEARCH_QUERY = "in:sent newer_than:30d";
const DEFAULT_MAX_RESULTS = 50;
const GMAIL_ORDER_LABELS = {
  orderEmails: "OTMAN/Order Emails",
  customerReplies: "OTMAN/Customer Replies",
  adminSent: "OTMAN/Admin Sent",
  needsAttention: "OTMAN/Needs Attention",
} as const;

type GmailSyncResult = {
  imported: number;
  skippedDuplicates: number;
  tokenNotFound: number;
  orderNotFound: number;
};

type ParsedGmailMessage = {
  gmailMessageId: string;
  gmailThreadId: string | null;
  externalMessageId: string | null;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  toName: string | null;
  sentAt: Date;
  token: string | null;
  inReplyTo: string | null;
  references: string[];
};

type MatchedOrder = {
  id: string;
  companyId: string;
  needsEmailAttention: boolean;
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
  const gmailMessageId = message.id?.trim();

  if (!gmailMessageId) {
    return null;
  }

  const payload = message.payload;
  const headers = payload?.headers;
  const subject = getHeader(headers, "Subject") || "Gmail message";
  const messageId = getHeader(headers, "Message-ID");
  const inReplyTo = getHeader(headers, "In-Reply-To");
  const referencesHeader = getHeader(headers, "References");
  const from = parseEmailAddress(getHeader(headers, "From"));
  const toHeader = getHeader(headers, "To");
  const ccHeader = getHeader(headers, "Cc");
  const replyToHeader = getHeader(headers, "Reply-To");
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
    gmailMessageId,
    gmailThreadId: message.threadId?.trim() || null,
    externalMessageId: messageId || null,
    subject,
    bodyText: bodyText || snippet,
    bodyHtml,
    fromEmail: from.email,
    fromName: from.name ?? null,
    toEmail: to?.email ?? getGmailAccountEmail(),
    toName: to?.name ?? null,
    sentAt,
    token:
      extractThreadTokenFromRecipients(replyToHeader) ||
      extractThreadTokenFromRecipients(toHeader) ||
      extractThreadTokenFromRecipients(ccHeader) ||
      extractThreadToken(subject, bodyText, bodyHtml, snippet),
    inReplyTo: inReplyTo || null,
    references: referencesHeader.split(/\s+/).map((item) => item.trim()).filter((item) => item.length > 0),
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

async function ensureGmailOrderLabels(
  gmail: gmail_v1.Gmail,
  userId: string,
): Promise<Record<keyof typeof GMAIL_ORDER_LABELS, string> | null> {
  try {
    const labelsResponse = await gmail.users.labels.list({
      userId,
    });
    const labelsByName = new Map(
      (labelsResponse.data.labels ?? [])
        .filter((label) => label.name && label.id)
        .map((label) => [label.name as string, label.id as string]),
    );
    const labelIds = {} as Record<keyof typeof GMAIL_ORDER_LABELS, string>;

    for (const [key, name] of Object.entries(GMAIL_ORDER_LABELS) as Array<[keyof typeof GMAIL_ORDER_LABELS, string]>) {
      const existingId = labelsByName.get(name);

      if (existingId) {
        labelIds[key] = existingId;
        continue;
      }

      const createdLabel = await gmail.users.labels.create({
        userId,
        requestBody: {
          name,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        },
      });
      const createdId = createdLabel.data.id;

      if (!createdId) {
        throw new Error(`GMAIL_LABEL_CREATE_MISSING_ID:${name}`);
      }

      labelsByName.set(name, createdId);
      labelIds[key] = createdId;
    }

    return labelIds;
  } catch (error) {
    console.warn("GMAIL SYNC LABEL SETUP FAILED", {
      reason: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    });
    return null;
  }
}

async function applyGmailOrderLabels({
  gmail,
  userId,
  parsed,
  direction,
  order,
  labelIds,
}: {
  gmail: gmail_v1.Gmail;
  userId: string;
  parsed: ParsedGmailMessage;
  direction: "INBOUND" | "OUTBOUND";
  order: MatchedOrder;
  labelIds: Record<keyof typeof GMAIL_ORDER_LABELS, string> | null;
}) {
  if (!labelIds) {
    return;
  }

  try {
    const addLabelIds =
      direction === "INBOUND"
        ? [labelIds.orderEmails, labelIds.customerReplies, labelIds.needsAttention]
        : [labelIds.orderEmails, labelIds.adminSent];
    const removeLabelIds = direction === "OUTBOUND" && !order.needsEmailAttention ? [labelIds.needsAttention] : [];

    await gmail.users.messages.modify({
      userId,
      id: parsed.gmailMessageId,
      requestBody: {
        addLabelIds,
        removeLabelIds,
      },
    });

    if (direction === "OUTBOUND" && !order.needsEmailAttention && parsed.gmailThreadId) {
      await gmail.users.threads.modify({
        userId,
        id: parsed.gmailThreadId,
        requestBody: {
          removeLabelIds: [labelIds.needsAttention],
        },
      });
    }
  } catch (error) {
    console.warn("GMAIL SYNC LABEL APPLY FAILED", {
      gmailMessageId: parsed.gmailMessageId,
      gmailThreadId: parsed.gmailThreadId,
      direction,
      reason: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    });
  }
}

export async function syncGmailOrderConversations(options?: {
  maxResults?: number;
  query?: string;
  sentQuery?: string;
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

  const seenMessageIds = new Set<string>();
  const labelIds = await ensureGmailOrderLabels(gmail, gmailUserId);
  const searchQueries = [
    options?.query ?? DEFAULT_INBOUND_SEARCH_QUERY,
    options?.sentQuery ?? DEFAULT_SENT_SEARCH_QUERY,
  ];

  for (const query of searchQueries) {
    const listResponse = await gmail.users.messages.list({
      userId: gmailUserId,
      q: query,
      maxResults: options?.maxResults ?? DEFAULT_MAX_RESULTS,
    });

    for (const listedMessage of listResponse.data.messages ?? []) {
      if (!listedMessage.id || seenMessageIds.has(listedMessage.id)) continue;
      seenMessageIds.add(listedMessage.id);

      const messageResponse = await gmail.users.messages.get({
        userId: gmailUserId,
        id: listedMessage.id,
        format: "full",
      });

      const parsed = parseGmailMessage(messageResponse.data);

      if (!parsed) {
        result.tokenNotFound += 1;
        continue;
      }

      const duplicate = await prisma.orderEmailMessage.findFirst({
        where: {
          OR: [
            { gmailMessageId: parsed.gmailMessageId },
            ...(parsed.externalMessageId ? [{ externalMessageId: parsed.externalMessageId }] : []),
          ],
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        console.log("GMAIL SYNC SKIPPED DUPLICATE", {
          gmailMessageId: parsed.gmailMessageId,
          externalMessageId: parsed.externalMessageId,
        });
        result.skippedDuplicates += 1;
        continue;
      }

      const orderByToken = parsed.token
        ? await prisma.order.findFirst({
            where: {
              emailThreadToken: parsed.token,
            },
            select: {
              id: true,
              companyId: true,
              needsEmailAttention: true,
            },
          })
        : null;
      const referenceIds = [...parsed.references, parsed.inReplyTo].filter((item): item is string => Boolean(item));
      const orderMessageCriteria = [
        ...(parsed.gmailThreadId ? [{ gmailThreadId: parsed.gmailThreadId }] : []),
        ...(referenceIds.length > 0 ? [{ externalMessageId: { in: referenceIds } }] : []),
      ];
      const orderMessageMatch =
        orderByToken || orderMessageCriteria.length === 0
          ? null
          : await prisma.orderEmailMessage.findFirst({
              where: {
                OR: orderMessageCriteria,
              },
              select: {
                orderId: true,
                companyId: true,
                order: {
                  select: {
                    needsEmailAttention: true,
                  },
                },
              },
            });
      const order: MatchedOrder | null =
        orderByToken ??
        (orderMessageMatch
          ? {
              id: orderMessageMatch.orderId,
              companyId: orderMessageMatch.companyId,
              needsEmailAttention: orderMessageMatch.order.needsEmailAttention,
            }
          : null);

      if (!order) {
        console.log("GMAIL SYNC ORDER NOT FOUND", {
          gmailMessageId: parsed.gmailMessageId,
          externalMessageId: parsed.externalMessageId,
          gmailThreadId: parsed.gmailThreadId,
          token: parsed.token,
          inReplyTo: parsed.inReplyTo,
          references: parsed.references,
        });
        if (!parsed.token && !parsed.gmailThreadId && referenceIds.length === 0) {
          result.tokenNotFound += 1;
        } else {
          result.orderNotFound += 1;
        }
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
          gmailMessageId: parsed.gmailMessageId,
          gmailThreadId: parsed.gmailThreadId,
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

      await applyGmailOrderLabels({
        gmail,
        userId: gmailUserId,
        parsed,
        direction,
        order,
        labelIds,
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
        gmailMessageId: parsed.gmailMessageId,
        externalMessageId: parsed.externalMessageId,
        orderId: order.id,
        direction,
      });
      result.imported += 1;
    }
  }

  return result;
}
