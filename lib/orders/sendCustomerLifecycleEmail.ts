import { prisma } from "@/lib/db";
import { sendGmailEmail } from "@/lib/email/sendGmailEmail";
import { formatGmailSenderName, getGmailSendAsEmail } from "@/lib/email/gmailAccounts";
import { htmlToText } from "@/lib/email/htmlToText";
import { createOrderActionEvent, type OrderEventActor } from "@/lib/orders/orderEvents";
import { buildReplyToAddress, createOrderEmailThreadToken } from "@/lib/orders/orderEmail";
import {
  buildPaymentRequestEmail,
  buildRejectedEmail,
  buildPaymentTimeoutEmail,
  buildBalanceDueEmail,
  buildOrderConfirmedEmail,
  buildOrderReceivedEmail,
  buildOrderUpdatedEmail,
  type LifecycleEmailOrder,
} from "@/lib/orders/customerLifecycleEmails";

// The kinds staff can (re)send from the dashboard. order_updated is only sent
// by the customer edit route, which has the change list it needs.
export const LIFECYCLE_EMAIL_KINDS = [
  "payment_request",
  "rejected",
  "payment_timeout",
  "balance_due",
  "order_confirmed",
  "order_received",
] as const;
export type LifecycleEmailKind = (typeof LIFECYCLE_EMAIL_KINDS)[number] | "order_updated";

// order_received goes out at submission, before staff approve/reject mint an
// actionToken, and order_updated links to "My order" (by order number), not
// to the token pages — every other kind builds links from the token and must
// not send without one.
export function lifecycleKindRequiresActionToken(kind: LifecycleEmailKind): boolean {
  return kind !== "order_received" && kind !== "order_updated";
}

export type LifecycleEmailOrderInput = LifecycleEmailOrder & {
  companyId: string;
  email: string | null;
  // The order's Email Center thread — reused if present, created on first
  // lifecycle send otherwise, so the customer's reply routes back into the
  // same conversation regardless of who (or what) sent the first message.
  emailThreadToken?: string | null;
  // Only needs to be passed when kind is "payment_request" — used to set
  // paymentRequestSentAt on first send only, so the payment-timeout sweep can
  // anchor its 24h reminder to when the customer was first asked to pay.
  paymentRequestSentAt?: Date | null;
};

export type SendLifecycleEmailsSummary = {
  sentCount: number;
  failedOrderIds: string[];
};

function buildEmailForKind(kind: LifecycleEmailKind, order: LifecycleEmailOrder) {
  if (kind === "payment_request") return buildPaymentRequestEmail(order);
  if (kind === "rejected") return buildRejectedEmail(order);
  if (kind === "balance_due") return buildBalanceDueEmail(order);
  if (kind === "order_confirmed") return buildOrderConfirmedEmail(order);
  if (kind === "order_received") return buildOrderReceivedEmail(order);
  if (kind === "order_updated") return buildOrderUpdatedEmail(order);
  return buildPaymentTimeoutEmail(order);
}

// Shared by the manual "send lifecycle email" API route, the automatic
// payment-timeout sweep, the Stripe webhook and the order-received email, so
// every path logs the same OrderEvent / OrderEmailMessage trail. Sends through
// the company Gmail account (Gmail API, "send as" the company address) — the
// same transport and Reply-To thread scheme as admin-composed Email Center
// messages — so a customer reply lands back on the order and Gmail sync
// recognises the message (source GMAIL + Gmail ids) instead of duplicating it.
// Orders are sent one after another: each send does its own Gmail profile /
// send-as lookups, and a bulk approve should not fire N of them at once.
export async function sendLifecycleEmailsForOrders(params: {
  orders: LifecycleEmailOrderInput[];
  kind: LifecycleEmailKind;
  actor: OrderEventActor;
}): Promise<SendLifecycleEmailsSummary> {
  const { orders, kind, actor } = params;
  const sentAt = new Date();
  const fromEmail = getGmailSendAsEmail();
  const fromName = formatGmailSenderName();

  const results: PromiseSettledResult<void>[] = [];
  for (const order of orders) {
    try {
      await sendOne(order);
      results.push({ status: "fulfilled", value: undefined });
    } catch (reason) {
      results.push({ status: "rejected", reason });
    }
  }

  async function sendOne(order: LifecycleEmailOrderInput) {
    if (lifecycleKindRequiresActionToken(kind) && !order.actionToken) {
      throw new Error(`Order ${order.id} has no actionToken`);
    }

    if (!order.email) {
      throw new Error(`Order ${order.id} has no customer email`);
    }

    const { subject, html } = buildEmailForKind(kind, order);
    const threadToken = order.emailThreadToken || createOrderEmailThreadToken();
    const recipientName = order.customerName ?? order.customerLabel ?? undefined;

    const sendResult = await sendGmailEmail({
      to: { email: order.email, name: recipientName },
      threadToken,
      subject,
      html,
      text: htmlToText(html),
      replyTo: buildReplyToAddress(threadToken),
      orderId: order.id,
      orderNumber: order.orderNumber ?? null,
      direction: "outbound",
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        lastEditedByMembershipId: actor.membershipId ?? null,
        lastOutboundEmailAt: sentAt,
        ...(order.emailThreadToken ? {} : { emailThreadToken: threadToken }),
        ...(kind === "payment_request" && !order.paymentRequestSentAt ? { paymentRequestSentAt: sentAt } : {}),
        ...(kind === "payment_timeout" ? { paymentReminderSentAt: sentAt } : {}),
      },
    });

    await prisma.orderEmailMessage.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        direction: "OUTBOUND",
        status: sendResult.syncWarning ? "SENT_WITH_SYNC_WARNING" : "SENT",
        source: "GMAIL",
        sentByMembershipId: actor.membershipId ?? null,
        externalMessageId: sendResult.messageId,
        gmailMessageId: sendResult.gmailMessageId,
        gmailThreadId: sendResult.gmailThreadId,
        subject,
        bodyHtml: html,
        fromEmail,
        fromName,
        toEmail: order.email,
        toName: recipientName ?? null,
        sentAt,
      },
    });

    await createOrderActionEvent(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      actor,
      title: `Sent ${kind} email`,
      details: [`Recipient: ${order.email}`],
      createdAt: sentAt,
    });
  }

  const failedEntries = orders
    .map((order, index) => ({ order, result: results[index] }))
    .filter((entry): entry is { order: LifecycleEmailOrderInput; result: PromiseRejectedResult } => entry.result.status === "rejected");

  if (failedEntries.length > 0) {
    await Promise.all(
      failedEntries.map(({ order, result }) =>
        prisma.orderEmailMessage.create({
          data: {
            orderId: order.id,
            companyId: order.companyId,
            direction: "OUTBOUND",
            status: "FAILED",
            sentByMembershipId: actor.membershipId ?? null,
            subject: `Failed to send ${kind} email`,
            bodyText: String(result.reason ?? "Unknown error"),
            fromEmail,
            fromName,
            toEmail: order.email ?? "",
            sentAt,
          },
        }),
      ),
    );
  }

  return {
    sentCount: orders.length - failedEntries.length,
    failedOrderIds: failedEntries.map((entry) => entry.order.id),
  };
}
