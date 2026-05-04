import dns from "node:dns";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

dns.setDefaultResultOrder("ipv4first");

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

 const smtpOptions = {
   host: "smtp.gmail.com",
   port: 587,
   secure: true,
   auth: {
     user: process.env.GMAIL_USER!,
     pass: process.env.GMAIL_APP_PASSWORD!,
   },
   family: 4,
 } satisfies SMTPTransport.Options & { family: 4 };

  const transporter = nodemailer.createTransport(smtpOptions);

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
