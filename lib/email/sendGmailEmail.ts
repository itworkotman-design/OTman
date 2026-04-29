import nodemailer from "nodemailer";

type Recipient = {
  email: string;
  name?: string;
};

function formatRecipient(recipient: Recipient) {
  return recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email;
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

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!, // app password, NOT your real password
    },
  });

  const info = await transporter.sendMail({
    from: `"OtmanTransportAS" <${process.env.GMAIL_USER!}>`,
    to: recipients.map(formatRecipient).join(", "),
    subject,
    html,
    text,
    replyTo,
    inReplyTo,
    references,
  });

  return {
    messageId: info.messageId || null,
  };
}
