import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/sendEmail";
import { getGmailSendAsEmail } from "@/lib/email/gmailAccounts";
import { createOrderActionEvent, type OrderEventActor } from "@/lib/orders/orderEvents";
import { buildReplyToAddress, createOrderEmailThreadToken } from "@/lib/orders/orderEmail";
import {
  buildPaymentRequestEmail,
  buildRejectedEmail,
  buildPaymentTimeoutEmail,
  type LifecycleEmailOrder,
} from "@/lib/orders/customerLifecycleEmails";

export const LIFECYCLE_EMAIL_KINDS = ["payment_request", "rejected", "payment_timeout"] as const;
export type LifecycleEmailKind = (typeof LIFECYCLE_EMAIL_KINDS)[number];

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
  return buildPaymentTimeoutEmail(order);
}

// Shared by the manual "send lifecycle email" API route and the automatic
// payment-timeout sweep, so both paths log the same OrderEvent / OrderEmailMessage
// trail regardless of who (or what) triggered the send. Also threads every
// lifecycle email into the order's Email Center conversation (same Reply-To
// scheme as admin-composed emails) so a customer reply lands back in the app.
export async function sendLifecycleEmailsForOrders(params: {
  orders: LifecycleEmailOrderInput[];
  kind: LifecycleEmailKind;
  actor: OrderEventActor;
}): Promise<SendLifecycleEmailsSummary> {
  const { orders, kind, actor } = params;
  const sentAt = new Date();
  const fromEmail = process.env.BREVO_SENDER_EMAIL || getGmailSendAsEmail();
  const fromName = process.env.BREVO_SENDER_NAME || "Otman";

  const results = await Promise.allSettled(
    orders.map(async (order) => {
      if (!order.actionToken) {
        throw new Error(`Order ${order.id} has no actionToken`);
      }

      if (!order.email) {
        throw new Error(`Order ${order.id} has no customer email`);
      }

      const { subject, html } = buildEmailForKind(kind, order);
      const threadToken = order.emailThreadToken || createOrderEmailThreadToken();
      const recipientName = order.customerName ?? order.customerLabel ?? undefined;

      await sendEmail({
        to: { email: order.email, name: recipientName },
        subject,
        html,
        replyTo: { email: buildReplyToAddress(threadToken) },
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
          status: "SENT",
          source: "APP",
          sentByMembershipId: actor.membershipId ?? null,
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
    }),
  );

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
