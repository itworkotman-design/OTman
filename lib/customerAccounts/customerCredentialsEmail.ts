import { prisma } from "@/lib/db";
import { sendGmailEmail } from "@/lib/email/sendGmailEmail";
import { formatGmailSenderName, getGmailSendAsEmail } from "@/lib/email/gmailAccounts";
import { htmlToText } from "@/lib/email/htmlToText";
import { createOrderActionEvent } from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { buildReplyToAddress, createOrderEmailThreadToken } from "@/lib/orders/orderEmail";
import {
  buildCustomerOrderUrls,
  buildSimpleEmailShell,
  buttonLink,
  customerGreetingName,
  escapeHtml,
  orderReference,
} from "@/lib/orders/customerLifecycleEmails";

// The login details for a temporary customer account (username = email, a
// generated password) — for a password reset and staff's "Send new login"; a
// new order's first password is in the order-received email instead. Sent
// through the company Gmail like the other order emails, threaded to the
// order. The copy logged on the order has the password masked, and is logged
// under the Gmail ids so Gmail sync skips the plaintext copy.

const MASK = "••••••••••••";

type CredentialsOrder = {
  id: string;
  companyId: string;
  displayId: number | null;
  orderNumber: string | null;
  customerName: string | null;
  // The order's Email Center thread — reused, or created and saved here.
  emailThreadToken?: string | null;
};

export function buildCustomerCredentialsEmail(params: { order: CredentialsOrder; email: string; password: string }) {
  const { order } = params;
  const reference = orderReference(order);
  const orderUrl = order.orderNumber ? buildCustomerOrderUrls(order.orderNumber).orderUrl : null;

  const subject = `Innlogging til bestillingen din ${reference}`.trim();
  const html = buildSimpleEmailShell(`
    <p style="margin:0 0 16px 0;">Hei ${escapeHtml(customerGreetingName({ customerName: order.customerName, customerLabel: null }))},</p>
    <p style="margin:0 0 16px 0;">
      Her er innloggingen til <strong>Min bestilling</strong>, der du kan se og endre bestillingen ${escapeHtml(reference)}.
    </p>
    <table style="margin:0 0 16px 0;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:4px 16px 4px 0;">Brukernavn</td><td style="padding:4px 0;font-weight:700;">${escapeHtml(params.email)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;">Passord</td><td style="padding:4px 0;font-weight:700;font-family:monospace;font-size:16px;">${escapeHtml(params.password)}</td></tr>
    </table>
    ${orderUrl ? `<div style="margin:20px 0;">${buttonLink(orderUrl, "Logg inn")}</div>` : ""}
    <p style="margin:0 0 16px 0;">
      Innloggingen slettes automatisk kort tid etter at bestillingen er fullført. Ikke del passordet med andre.
    </p>
  `);

  return { subject, html };
}

// Returns whether the email went out. Never throws — like the order-received
// email, a failure raises a staff alert instead of failing the caller.
export async function sendCustomerCredentialsEmail(params: {
  order: CredentialsOrder;
  email: string;
  password: string;
}): Promise<boolean> {
  const { order, email } = params;
  const sentAt = new Date();
  const fromEmail = getGmailSendAsEmail();
  const fromName = formatGmailSenderName();

  try {
    // Built inside the try: building can throw too (no ORDER_ACTION_BASE_URL),
    // and this function must never fail the caller — the order is saved.
    const logged = buildCustomerCredentialsEmail({ ...params, password: MASK });
    const { subject, html } = buildCustomerCredentialsEmail(params);
    const threadToken = order.emailThreadToken || createOrderEmailThreadToken();
    const result = await sendGmailEmail({
      to: { email, name: order.customerName ?? undefined },
      threadToken,
      subject,
      html,
      text: htmlToText(html),
      replyTo: buildReplyToAddress(threadToken),
      orderId: order.id,
      orderNumber: order.orderNumber,
      direction: "outbound",
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { lastOutboundEmailAt: sentAt, ...(order.emailThreadToken ? {} : { emailThreadToken: threadToken }) },
    });

    await prisma.orderEmailMessage.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        direction: "OUTBOUND",
        status: result.syncWarning ? "SENT_WITH_SYNC_WARNING" : "SENT",
        source: "GMAIL",
        externalMessageId: result.messageId,
        gmailMessageId: result.gmailMessageId,
        gmailThreadId: result.gmailThreadId,
        subject: logged.subject,
        bodyHtml: logged.html,
        fromEmail,
        fromName,
        toEmail: email,
        toName: order.customerName,
        sentAt,
      },
    });
    await createOrderActionEvent(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      actor: { source: "SYSTEM", name: "Website" },
      title: "Sent customer login details",
      details: [`Recipient: ${email}`],
      createdAt: sentAt,
    });
    return true;
  } catch {
    // The error text could echo the request (and so the password) — keep it
    // out of logs and the DB.
    console.error("[customer credentials email] Failed to send for order", order.id);
    try {
      await prisma.orderEmailMessage.create({
        data: {
          orderId: order.id,
          companyId: order.companyId,
          direction: "OUTBOUND",
          status: "FAILED",
          subject: `Failed to send login details for order ${orderReference(order)}`.trim(),
          bodyText: "The login details email could not be sent.",
          fromEmail,
          toEmail: email,
          sentAt,
        },
      });
      await createOrderNotification(prisma, {
        orderId: order.id,
        companyId: order.companyId,
        type: "MANUAL_REVIEW",
        title: "Customer login email NOT sent",
        message: `The login details for order ${orderReference(order)} FAILED to send to ${email}. Use "Send new login" on the order, or contact the customer.`,
      });
    } catch (alertError) {
      console.error("[customer credentials email] Could not raise staff alert", order.id, alertError);
    }
    return false;
  }
}
