import { prisma } from "@/lib/db";
import { createOrderStatusChangedEvent } from "@/lib/orders/orderEvents";
import { sendLifecycleEmailsForOrders } from "@/lib/orders/sendCustomerLifecycleEmail";

const REMINDER_DELAY_HOURS = 24;
const CANCELLATION_DELAY_DAYS = 3;
const SWEEP_ACTOR = { source: "SYSTEM", name: "Payment timeout" } as const;

export type PaymentTimeoutSummary = {
  remindersSent: number;
  remindersFailed: number;
  cancelled: number;
  cancelFailed: number;
};

function hoursAgo(hours: number): Date {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

const ORDER_EMAIL_SELECT = {
  id: true,
  companyId: true,
  status: true,
  displayId: true,
  customerName: true,
  customerLabel: true,
  statusNotes: true,
  actionToken: true,
  email: true,
  emailThreadToken: true,
} as const;

// Called by the daily cron route (and available for a manual "run now").
// Two independent phases for an approved website order that never got paid:
//   1. 24h after the payment-request email was first sent, automatically send
//      a payment-reminder email (the "Send payment-reminder email" button on
//      the Website Orders page stays available for an extra manual resend).
//   2. 3 days after that reminder went out, if the order is still unpaid,
//      cancel it.
export async function runPaymentTimeoutSweep(params?: { limit?: number }): Promise<PaymentTimeoutSummary> {
  const [reminderResult, cancellationResult] = await Promise.all([
    sendDueReminders(params?.limit),
    cancelOverdueOrders(params?.limit),
  ]);

  return {
    remindersSent: reminderResult.sent,
    remindersFailed: reminderResult.failed,
    cancelled: cancellationResult.cancelled,
    cancelFailed: cancellationResult.failed,
  };
}

async function sendDueReminders(limit?: number): Promise<{ sent: number; failed: number }> {
  const cutoff = hoursAgo(REMINDER_DELAY_HOURS);

  const candidates = await prisma.order.findMany({
    where: {
      status: "approved",
      isWebsiteOrder: true,
      paymentRequestSentAt: { lte: cutoff },
      paymentReminderSentAt: null,
    },
    select: ORDER_EMAIL_SELECT,
    orderBy: { paymentRequestSentAt: "asc" },
    take: limit,
  });

  if (candidates.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const { sentCount, failedOrderIds } = await sendLifecycleEmailsForOrders({
    orders: candidates,
    kind: "payment_timeout",
    actor: SWEEP_ACTOR,
  });

  if (failedOrderIds.length > 0) {
    console.error("Payment timeout sweep: failed to send reminder email for orders", failedOrderIds);
  }

  return { sent: sentCount, failed: failedOrderIds.length };
}

async function cancelOverdueOrders(limit?: number): Promise<{ cancelled: number; failed: number }> {
  const cutoff = daysAgo(CANCELLATION_DELAY_DAYS);

  const candidates = await prisma.order.findMany({
    where: {
      status: "approved",
      isWebsiteOrder: true,
      paymentReminderSentAt: { lte: cutoff },
    },
    select: { id: true, companyId: true, status: true },
    orderBy: { paymentReminderSentAt: "asc" },
    take: limit,
  });

  let cancelled = 0;
  let failed = 0;

  for (const order of candidates) {
    try {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "cancelled" },
      });

      await createOrderStatusChangedEvent(prisma, {
        orderId: order.id,
        companyId: order.companyId,
        actor: SWEEP_ACTOR,
        fromStatus: order.status,
        toStatus: "cancelled",
        note: `No payment received within ${CANCELLATION_DELAY_DAYS} days of the payment-reminder email.`,
      });

      cancelled += 1;
    } catch (error) {
      console.error("Payment timeout sweep: failed to cancel order", order.id, toErrorMessage(error));
      failed += 1;
    }
  }

  return { cancelled, failed };
}

export function parsePaymentTimeoutLimitParam(searchParams: URLSearchParams): number | undefined {
  const raw = searchParams.get("limit");
  if (!raw) return undefined;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}
