import { randomUUID } from "crypto";

export type EmailAddress = {
  email: string;
  name?: string | null;
};

type OrderConversationReplyContext = {
  bodyText: string;
  personLabel: string;
  sentAtLabel: string;
};

const THREAD_TOKEN_REGEX = /\[OTMAN:([a-z0-9]+)\]/i;

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

export function buildThreadedSubject(subject: string, threadToken: string): string {
  const trimmed = subject.trim();
  const suffix = `[OTMAN:${threadToken}]`;

  if (!trimmed) {
    return suffix;
  }

  if (THREAD_TOKEN_REGEX.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed} ${suffix}`;
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

export function buildReplyToAddress(threadToken: string): string | null {
  const domain = process.env.EMAIL_REPLY_DOMAIN?.trim();

  if (!domain) {
    return null;
  }

  return `reply+${threadToken}@${domain}`;
}

export function extractThreadTokenFromRecipientValue(
  value: string,
): string | null {
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

export function buildOrderConversationEmailText(input: {
  messageText: string;
  orderLabel: string;
  replyContext?: OrderConversationReplyContext | null;
}): string {
  const parts = [input.orderLabel.trim(), "", input.messageText.trim()];

  if (input.replyContext) {
    parts.push(buildQuotedReplyText(input.replyContext));
  }

  parts.push(
    "",
    "Med vennlig hilsen,",
    "Otman Transport AS",
    "+47 402 84 977 | bestilling@otman.no",
  );

  return parts.join("\n").trim();
}

export function buildOrderConversationEmailHtml(input: {
  messageText: string;
  orderLabel: string;
  replyContext?: OrderConversationReplyContext | null;
}): string {
  const body = convertPlainTextToHtml(input.messageText.trim());
  const quotedReply = input.replyContext
    ? `
      <div style="margin-top:24px;padding-left:12px;border-left:2px solid #d1d5db;">
        <p style="margin:0 0 12px 0;color:#6b7280;font-size:12px;">
          On ${escapeHtml(input.replyContext.sentAtLabel)}, ${escapeHtml(input.replyContext.personLabel)} wrote:
        </p>
        ${convertPlainTextToHtml(input.replyContext.bodyText)}
      </div>
    `
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
      <p style="margin:0 0 16px 0;">${escapeHtml(input.orderLabel)}</p>
      ${body}
      ${quotedReply}
      <p style="margin:24px 0 0 0;">
        Med vennlig hilsen,<br/>
        Otman Transport AS<br/>
        +47 402 84 977 | bestilling@otman.no
      </p>
    </div>
  `;
}
