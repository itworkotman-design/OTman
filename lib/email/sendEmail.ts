export async function sendEmail({
  to,
  bcc,
  subject,
  html,
  text,
  headers,
  replyTo,
}: {
  to: Array<{ email: string; name?: string }> | { email: string; name?: string };
  bcc?:
    | Array<{ email: string; name?: string }>
    | { email: string; name?: string }
    | null;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  replyTo?: { email: string; name?: string } | null;
}) {
  const recipients = Array.isArray(to) ? to : [to];
  const backupRecipients = !bcc ? [] : Array.isArray(bcc) ? bcc : [bcc];

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME!,
        email: process.env.BREVO_SENDER_EMAIL!,
      },
      to: recipients.map((recipient) => ({
        email: recipient.email,
        name: recipient.name ?? recipient.email,
      })),
      bcc:
        backupRecipients.length > 0
          ? backupRecipients.map((recipient) => ({
              email: recipient.email,
              name: recipient.name ?? recipient.email,
            }))
          : undefined,
      replyTo: replyTo
        ? {
            email: replyTo.email,
            name: replyTo.name ?? replyTo.email,
          }
        : undefined,
      headers,
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Brevo send failed: ${errorText}`);
  }

  const data = (await res.json().catch(() => null)) as
    | {
        messageId?: unknown;
      }
    | null;

  return {
    messageId: typeof data?.messageId === "string" ? data.messageId : null,
  };
}
