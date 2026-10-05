import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/sendEmail";
import { htmlToText } from "@/lib/email/htmlToText";
import { createOrderActionEvent } from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import {
  buildCustomerOrderUrls,
  buildSimpleEmailShell,
  buttonLink,
  customerGreetingName,
  escapeHtml,
  orderReference,
} from "@/lib/orders/customerLifecycleEmails";

// The login details for a temporary customer account (username = email, a
// generated password). Sent on its own, through Brevo — never through the
// company Gmail account the other order emails use, where the password would
// sit in plaintext in Gmail's Sent folder and the order's Email Center. The
// copy logged on the order has the password masked.

const MASK = "••••••••••••";

type CredentialsOrder = {
  id: string;
  companyId: string;
  displayId: number | null;
  orderNumber: string | null;
  customerName: string | null;
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
  const fromEmail = process.env.BREVO_SENDER_EMAIL ?? "";
  const logged = buildCustomerCredentialsEmail({ ...params, password: MASK });

  try {
    const { subject, html } = buildCustomerCredentialsEmail(params);
    const result = await sendEmail({
      to: { email, name: order.customerName ?? undefined },
      subject,
      html,
      text: htmlToText(html),
    });

    await prisma.orderEmailMessage.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        direction: "OUTBOUND",
        status: "SENT",
        externalMessageId: result.messageId,
        subject: logged.subject,
        bodyHtml: logged.html,
        fromEmail,
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
          subject: `Failed to send ${logged.subject}`,
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
