import { google } from "googleapis";

type Recipient = {
  email: string;
  name?: string;
};

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
}: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
}) {
  const boundary = `boundary_${Date.now()}`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    replyTo ? `Reply-To: ${replyTo}` : null,
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
  subject,
  html,
  text,
  replyTo,
  inReplyTo,
  references,
}: {
  to: Recipient | Recipient[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
}) {
  const recipients = Array.isArray(to) ? to : [to];

  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!);

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const from = `"OtmanTransportAS" <${process.env.GMAIL_USER!}>`;

  const mime = buildMimeMessage({
    from,
    to: recipients.map(formatRecipient).join(", "),
    subject,
    html,
    text,
    replyTo,
    inReplyTo,
    references,
  });

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodeBase64Url(mime),
    },
  });

  return {
    messageId: response.data.id ?? null,
  };
}
