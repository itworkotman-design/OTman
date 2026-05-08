import { google } from "googleapis";
import { formatGmailSenderName, getGmailAccountEmail, getGmailSendAsEmail, normalizeEmail } from "@/lib/email/gmailAccounts";

export const REQUIRED_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
] as const;

type Recipient = {
  email: string;
  name?: string;
};

export function getGmailErrorDebug(error: unknown) {
  const candidate = error as {
    message?: unknown;
    code?: unknown;
    status?: unknown;
    response?: {
      data?: unknown;
    };
    stack?: unknown;
  };

  return {
    message: typeof candidate?.message === "string" ? candidate.message : undefined,
    code: candidate?.code,
    status: candidate?.status,
    responseData: candidate?.response?.data,
    stack: typeof candidate?.stack === "string" ? candidate.stack : undefined,
  };
}

export function isGmailOAuthScopeMissing(error: unknown) {
  const debug = getGmailErrorDebug(error);
  const haystack = JSON.stringify({
    message: debug.message,
    responseData: debug.responseData,
  }).toLowerCase();

  return (
    debug.status === 403 &&
    (haystack.includes("insufficient authentication scopes") ||
      haystack.includes("insufficient permission") ||
      haystack.includes("insufficientpermissions") ||
      haystack.includes("access not configured"))
  );
}

function formatSendAsAliases(
  aliases:
    | Array<{
        sendAsEmail?: string | null;
        verificationStatus?: string | null;
        isDefault?: boolean | null;
        displayName?: string | null;
        replyToAddress?: string | null;
        treatAsAlias?: boolean | null;
      }>
    | undefined,
) {
  return (aliases ?? []).map((alias) => ({
    sendAsEmail: normalizeEmail(alias.sendAsEmail),
    verificationStatus: alias.verificationStatus ?? null,
    isDefault: alias.isDefault ?? null,
    displayName: alias.displayName ?? null,
    replyToAddress: alias.replyToAddress ?? null,
    treatAsAlias: alias.treatAsAlias ?? null,
  }));
}

function formatRecipient(recipient: Recipient) {
  return recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildMimeMessage({
  from,
  to,
  subject,
  html,
  text,
  replyTo,
  inReplyTo,
  references,
  bcc,
  threadToken,
}: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  bcc?: string;
  threadToken?: string;
}) {
  const boundary = `boundary_${Date.now()}`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `X-Otman-Conversation: true`,
    threadToken ? `X-Otman-Thread: ${threadToken}` : null,
    bcc ? `Bcc: ${bcc}` : null,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    replyTo ? `Reply-To: ${replyTo}` : `Reply-To: ${getGmailSendAsEmail()}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references?.length ? `References: ${references.join(" ")}` : null,
  ].filter(Boolean);

  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    text ?? "",
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    html,
    `--${boundary}--`,
  ].join("\r\n");

  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

export async function sendGmailEmail({
  to,
  bcc,
  threadToken,
  subject,
  html,
  text,
  replyTo,
  inReplyTo,
  references,
  gmailThreadId: existingGmailThreadId,
}: {
  to: Recipient | Recipient[];
  bcc?: Recipient | Recipient[] | string;
  threadToken?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  gmailThreadId?: string | null;
}) {
  const recipients = Array.isArray(to) ? to : [to];

  const bccRecipients =
    typeof bcc === "string" ? bcc : bcc ? (Array.isArray(bcc) ? bcc : [bcc]).map(formatRecipient).join(", ") : process.env.ORDER_CONVERSATION_BACKUP_EMAIL;

  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!);

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const configuredAccountEmail = getGmailAccountEmail();
  const configuredSendAsEmail = getGmailSendAsEmail();
  const profile = await gmail.users.getProfile({
    userId: "me",
  });
  const oauthAccountEmail = profile.data.emailAddress ?? "";
  let sendAsAliases: ReturnType<typeof formatSendAsAliases> = [];

  try {
    const sendAsResponse = await gmail.users.settings.sendAs.list({
      userId: configuredAccountEmail || "me",
    });
    sendAsAliases = formatSendAsAliases(sendAsResponse.data.sendAs);
    console.log("GMAIL SEND users.settings.sendAs.list RESULT", {
      oauthAccountEmail,
      configuredAccountEmail,
      configuredSendAsEmail,
      sendAsAliases,
    });
  } catch (error) {
    console.warn("GMAIL SEND AS ALIASES LOOKUP FAILED", {
      oauthAccountEmail,
      configuredAccountEmail,
      configuredSendAsEmail,
      error: getGmailErrorDebug(error),
    });
  }

  console.log("GMAIL SEND STARTUP DEBUG", {
    oauthAccountEmail,
    configuredAccountEmail,
    configuredSendAsEmail,
    sendAsAliases,
  });

  if (normalizeEmail(oauthAccountEmail) !== configuredAccountEmail) {
    throw new Error("GMAIL_ACCOUNT_MISMATCH");
  }

  const configuredSendAsAlias = sendAsAliases.find((alias) => alias.sendAsEmail === configuredSendAsEmail);
  if (sendAsAliases.length > 0 && (!configuredSendAsAlias || configuredSendAsAlias.verificationStatus !== "accepted")) {
    console.error("GMAIL SEND AS ALIAS NOT ACCEPTED", {
      configuredSendAsEmail,
      configuredSendAsAlias: configuredSendAsAlias ?? null,
      sendAsAliases,
    });
    throw new Error("GMAIL_SEND_AS_ALIAS_NOT_ACCEPTED");
  }

  const from = `"${formatGmailSenderName()}" <${configuredSendAsEmail}>`;

  const mime = buildMimeMessage({
    from,
    to: recipients.map(formatRecipient).join(", "),
    subject,
    html,
    text,
    replyTo,
    inReplyTo,
    references,
    bcc: bccRecipients,
    threadToken,
  });

  console.log("GMAIL SEND BEFORE users.messages.send", {
    userId: configuredAccountEmail,
    from,
    to: recipients.map((recipient) => recipient.email),
    bcc: bccRecipients,
    replyTo,
    inReplyTo,
    references,
    gmailThreadId: existingGmailThreadId,
    threadToken,
    subject,
  });

  let response;
  try {
    response = await gmail.users.messages.send({
      userId: configuredAccountEmail,
      requestBody: {
        raw: encodeBase64Url(mime),
        threadId: existingGmailThreadId || undefined,
      },
    });
  } catch (error) {
    console.error("GMAIL SEND users.messages.send FAILED", getGmailErrorDebug(error));
    throw error;
  }

  console.log("GMAIL SEND AFTER users.messages.send", {
    id: response.data.id ?? null,
    threadId: response.data.threadId ?? null,
    labelIds: response.data.labelIds ?? null,
  });

  const gmailMessageId = response.data.id ?? null;
  const gmailThreadId = response.data.threadId ?? null;

  let rfcMessageId: string | null = null;
  let syncWarning: string | null = null;

  if (gmailMessageId) {
    try {
      console.log("GMAIL SEND BEFORE users.messages.get metadata", {
        userId: configuredAccountEmail,
        id: gmailMessageId,
      });
      const sentMessage = await gmail.users.messages.get({
        userId: configuredAccountEmail,
        id: gmailMessageId,
        format: "metadata",
        metadataHeaders: ["Message-ID"],
      });

      rfcMessageId = sentMessage.data.payload?.headers?.find((header) => header.name?.toLowerCase() === "message-id")?.value ?? null;
    } catch (error) {
      console.error("GMAIL SEND users.messages.get metadata FAILED", getGmailErrorDebug(error));
      syncWarning = error instanceof Error && error.message ? error.message : "GMAIL_SENT_MESSAGE_METADATA_LOOKUP_FAILED";
    }
  }

  return {
    messageId: rfcMessageId,
    gmailMessageId,
    gmailThreadId,
    oauthAccountEmail,
    senderAccount: configuredSendAsEmail,
    syncWarning,
  };
}
