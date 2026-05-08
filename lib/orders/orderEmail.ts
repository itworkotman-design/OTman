import { randomUUID } from "crypto";
import { getGmailSendAsEmail } from "@/lib/email/gmailAccounts";

export type EmailAddress = {
  email: string;
  name?: string | null;
};

type OrderConversationReplyContext = {
  bodyText: string;
  personLabel: string;
  sentAtLabel: string;
};

type OrderConversationMessageForQuote = {
  direction: "INBOUND" | "OUTBOUND";
  source: string;
  bodyText: string | null;
  fromEmail: string;
  fromName: string | null;
  createdAt: Date;
};

const THREAD_TOKEN_REGEX = /\[OTMAN:([a-z0-9_-]+)\]/i;
const REPLY_ADDRESS_TOKEN_REGEX = /reply\+([a-z0-9_-]+)@reply\.otman\.no/i;
const OTMAN_LOGO_URL = "https://otman.no/wp-content/uploads/2023/12/logo-removebg.png";

export function stripThreadTokenMarkers(value: string): string {
  return value
    .replace(/\s*\[OTMAN:[a-z0-9_-]+\]/gi, "")
    .replace(/[ \t]+\r?\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function extractEmailAddressFromString(value: string): EmailAddress | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(.*?)<([^>]+)>$/);

  if (match) {
    const email = match[2]?.trim().toLowerCase();

    if (!email) {
      return null;
    }

    const name = match[1]?.trim().replace(/^"|"$/g, "") || null;

    return {
      email,
      name,
    };
  }

  return {
    email: trimmed.toLowerCase(),
    name: null,
  };
}

export function createOrderEmailThreadToken(): string {
  return randomUUID().replaceAll("-", "");
}

export function buildReplySubject(subject: string): string {
  const trimmed = subject.trim();

  if (!trimmed) {
    return "Re:";
  }

  if (/^re:/i.test(trimmed)) {
    return trimmed;
  }

  return `Re: ${trimmed}`;
}

export function extractThreadTokenFromSubject(subject: string | null | undefined) {
  if (!subject) {
    return null;
  }

  const match = subject.match(THREAD_TOKEN_REGEX);
  return match?.[1]?.toLowerCase() ?? null;
}

export function buildReplyToAddress(threadToken: string): string {
  return `reply+${threadToken}@reply.otman.no`;
}

export function extractThreadTokenFromRecipientValue(
  value: string,
): string | null {
  const directMatch = value.match(REPLY_ADDRESS_TOKEN_REGEX);
  if (directMatch?.[1]) {
    return directMatch[1].toLowerCase();
  }

  const parsed = extractEmailAddressFromString(value);

  if (!parsed) {
    return null;
  }

  const [localPart] = parsed.email.split("@");

  if (!localPart) {
    return null;
  }

  const match = localPart.match(/^reply\+([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function extractThreadTokenFromRecipients(
  value: unknown,
): string | null {
  if (typeof value === "string") {
    return extractThreadTokenFromRecipientValue(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const token: string | null = extractThreadTokenFromRecipients(item);

      if (token) {
        return token;
      }
    }
  }

  if (value && typeof value === "object") {
    const candidate = value as {
      email?: unknown;
      address?: unknown;
      value?: unknown;
    };

    if (typeof candidate.email === "string") {
      return extractThreadTokenFromRecipientValue(candidate.email);
    }

    if (typeof candidate.address === "string") {
      return extractThreadTokenFromRecipientValue(candidate.address);
    }

    if (candidate.value !== undefined) {
      return extractThreadTokenFromRecipients(candidate.value);
    }
  }

  return null;
}

export function parseEmailAddress(value: unknown): EmailAddress | null {
  if (typeof value === "string") {
    return extractEmailAddressFromString(value);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    email?: unknown;
    address?: unknown;
    name?: unknown;
  };

  const email =
    typeof candidate.email === "string"
      ? candidate.email.trim().toLowerCase()
      : typeof candidate.address === "string"
        ? candidate.address.trim().toLowerCase()
        : "";

  if (!email) {
    return null;
  }

  return {
    email,
    name: typeof candidate.name === "string" ? candidate.name.trim() : null,
  };
}

export function convertPlainTextToHtml(text: string): string {
  return text
    .split(/\r?\n\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px 0;">${escapeHtml(paragraph).replaceAll("\n", "<br/>")}</p>`,
    )
    .join("");
}

function buildQuotedReplyText({
  bodyText,
  personLabel,
  sentAtLabel,
}: OrderConversationReplyContext): string {
  const quotedLines = bodyText
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");

  return [
    "",
    "",
    `On ${sentAtLabel}, ${personLabel} wrote:`,
    quotedLines,
  ].join("\n");
}

export function getInitialAppMessageQuoteContext(
  messages: OrderConversationMessageForQuote[],
): OrderConversationReplyContext | null {
  const initialAppMessage = messages.find(
    (message) =>
      message.direction === "INBOUND" &&
      message.source === "APP" &&
      Boolean(message.bodyText?.trim()),
  );

  if (!initialAppMessage) {
    return null;
  }

  const hasOutboundAfterInitialAppMessage = messages.some(
    (message) =>
      message.direction === "OUTBOUND" &&
      message.createdAt.getTime() > initialAppMessage.createdAt.getTime(),
  );

  if (hasOutboundAfterInitialAppMessage) {
    return null;
  }

  const hasNewerNonAppInbound = messages.some(
    (message) =>
      message.direction === "INBOUND" &&
      message.source !== "APP" &&
      message.createdAt.getTime() > initialAppMessage.createdAt.getTime(),
  );

  if (hasNewerNonAppInbound) {
    return null;
  }

  return {
    bodyText: initialAppMessage.bodyText ?? "",
    personLabel: initialAppMessage.fromName || initialAppMessage.fromEmail || "Customer",
    sentAtLabel: initialAppMessage.createdAt.toLocaleString("nb-NO"),
  };
}

export function buildOrderConversationEmailText(input: {
  messageText: string;
  orderLabel: string;
  threadToken: string;
  replyContext?: OrderConversationReplyContext | null;
}): string {
  const parts = [stripThreadTokenMarkers(input.messageText)];

  if (input.replyContext) {
    parts.push(buildQuotedReplyText({
      ...input.replyContext,
      bodyText: stripThreadTokenMarkers(input.replyContext.bodyText),
    }));
  }

  parts.push(
    "",
    "Med vennlig hilsen | Best regards,",
    "Logistikkavdeling | Logistics department",
    "OTMAN TRANSPORT AS",
    "+47 402 84 977",
    "Otman Transport AS | otman.no",
  );

  return parts.join("\n").trim();
}

export function buildOrderConversationEmailHtml(input: {
  messageText: string;
  orderLabel: string;
  threadToken: string;
  replyContext?: OrderConversationReplyContext | null;
}): string {
  const body = convertPlainTextToHtml(stripThreadTokenMarkers(input.messageText));
  const replyContextBody = input.replyContext
    ? stripThreadTokenMarkers(input.replyContext.bodyText)
    : "";
  const quotedReply = input.replyContext
    ? `
      <div style="margin-top:24px;padding-left:12px;border-left:2px solid #d1d5db;">
        <p style="margin:0 0 12px 0;color:#6b7280;font-size:12px;">
          On ${escapeHtml(input.replyContext.sentAtLabel)}, ${escapeHtml(input.replyContext.personLabel)} wrote:
        </p>
        ${convertPlainTextToHtml(replyContextBody)}
      </div>
    `
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
      ${body}
      ${quotedReply}
      <p style="margin:24px 0 0 0;">
        Med vennlig hilsen | Best regards,<br/>
        Logistikkavdeling | Logistics department<br/>
        OTMAN TRANSPORT AS<br/>
        +47 402 84 977<br/>
        Otman Transport AS | <a href="https://otman.no" style="color:#111827;text-decoration:underline;">otman.no</a>
      </p>
      <p style="margin:16px 0 0 0;">
        <img
          src="${OTMAN_LOGO_URL}"
          alt="Otman Transport AS"
          width="140"
          style="display:block;width:140px;max-width:140px;height:auto;border:0;"
        />
      </p>
    </div>
  `;
}
