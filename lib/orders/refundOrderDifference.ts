import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import { refundOrderPayments } from "@/lib/orders/orderRefunds";
import { ORDER_PAYMENT_LEDGER_SELECT } from "@/lib/orders/orderPayments";
import { ORDER_STATE_SOURCE_SELECT, buildOrderStateSnapshot, compareOrderWithPayments } from "@/lib/orders/paidOrderSnapshot";
import { describeDetailChange, describeLineChange, formatKr } from "@/lib/orders/orderChangeText";
import { createOrderActionEvent, type OrderEventActor } from "@/lib/orders/orderEvents";
import { sendLifecycleEmailsForOrders } from "@/lib/orders/sendCustomerLifecycleEmail";

// Refunds what a website-order customer has overpaid — the order's price
// went down after they paid (a discount after a problem on the day, a
// cheaper "My order" change) — through Stripe, and records the order as it
// is now as the new paid state, so the payment summary is settled and later
// changes compare against it. The status is left alone.
//
// Used by "Refund difference" (app/api/orders/[orderId]/refund-difference,
// which passes the amount staff saw as `expectedAmountCents`) and when staff
// set an order back to confirmed (app/api/orders/bulk).

export type RefundDifferenceResult =
  | { ok: true; refundedCents: number; emailFailed: boolean }
  | {
      ok: false;
      reason: "NOT_FOUND" | "NOTHING_TO_REFUND" | "AMOUNT_CHANGED" | "REFUND_FAILED" | "REFUND_NOT_POSSIBLE";
      status: number;
      amountCents?: number;
      refundedCents?: number;
    };

export async function refundOrderDifference(input: {
  orderId: string;
  companyId: string;
  actor: OrderEventActor;
  expectedAmountCents?: number;
}): Promise<RefundDifferenceResult> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, companyId: input.companyId },
    select: {
      ...ORDER_STATE_SOURCE_SELECT,
      id: true,
      companyId: true,
      displayId: true,
      orderNumber: true,
      status: true,
      isWebsiteOrder: true,
      customerName: true,
      customerLabel: true,
      statusNotes: true,
      actionToken: true,
      email: true,
      emailThreadToken: true,
      payments: { select: ORDER_PAYMENT_LEDGER_SELECT },
    },
  });
  if (!order || !order.isWebsiteOrder) {
    return { ok: false, reason: "NOT_FOUND", status: 404 };
  }

  const current = buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] });
  const comparison = compareOrderWithPayments({ payments: order.payments, current });
  if (comparison.outcome !== "refund") {
    return { ok: false, reason: "NOTHING_TO_REFUND", status: 409 };
  }

  const amountCents = Math.round(-comparison.differenceIncVatNok * 100);
  if (input.expectedAmountCents !== undefined && input.expectedAmountCents !== amountCents) {
    return { ok: false, reason: "AMOUNT_CHANGED", status: 409, amountCents };
  }

  const refund = await refundOrderPayments(prisma, getStripeClient(), {
    orderId: order.id,
    companyId: order.companyId,
    amountCents,
    reason: "Price lowered after payment",
    orderSnapshot: current,
  });
  if (!refund.ok) {
    if (refund.reason === "STRIPE_ERROR") {
      // Whatever went through is in the ledger; the summary shows what's left.
      return { ok: false, reason: "REFUND_FAILED", status: 502, refundedCents: refund.refundedCents };
    }
    return { ok: false, reason: "REFUND_NOT_POSSIBLE", status: 409 };
  }

  const changes = [
    ...comparison.lineChanges.map((change) => describeLineChange(change, "no")),
    ...comparison.detailChanges.map((change) => describeDetailChange(change, "no")),
  ];
  const refundedIncVatNok = refund.refundedCents / 100;

  await createOrderActionEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: input.actor,
    title: `Refunded ${formatKr(refundedIncVatNok)} to the customer via Stripe`,
    details: changes,
  });

  // Best-effort: the money has gone back whether or not the email does.
  let emailFailed = false;
  if (order.email) {
    try {
      const sent = await sendLifecycleEmailsForOrders({
        orders: [
          {
            ...order,
            refundIssued: { refundedIncVatNok, totalIncVatNok: comparison.currentTotalIncVatNok, changes },
          },
        ],
        kind: "refund_issued",
        actor: input.actor,
      });
      emailFailed = sent.failedOrderIds.length > 0;
    } catch (error) {
      console.error("[refund-difference] Failed to send the refund email", order.id, error);
      emailFailed = true;
    }
  }

  return { ok: true, refundedCents: refund.refundedCents, emailFailed };
}
