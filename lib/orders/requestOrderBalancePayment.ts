import { prisma } from "@/lib/db";
import { ORDER_PAYMENT_LEDGER_SELECT } from "@/lib/orders/orderPayments";
import { ORDER_STATE_SOURCE_SELECT, buildOrderStateSnapshot, compareOrderWithPayments } from "@/lib/orders/paidOrderSnapshot";
import { describeDetailChange, describeLineChange, formatKr } from "@/lib/orders/orderChangeText";
import { createOrderActionEvent, type OrderEventActor } from "@/lib/orders/orderEvents";
import { createOrderActionToken } from "@/lib/orders/orderActionToken";
import { sendLifecycleEmailsForOrders } from "@/lib/orders/sendCustomerLifecycleEmail";

// "Send payment request" on a website order paid by Stripe whose price went
// up after the customer paid: emails them the balance-due email — what
// changed and a link to /betaling/[token], which charges exactly the
// difference (a top-up, app/api/public/orders/[token]/checkout). The
// counterpart of refundOrderDifference.ts. Nothing about the order changes
// except a pay-link token minted if it has none; the webhook marks it paid.
//
// Used by POST /api/orders/[orderId]/request-payment, which passes the amount
// staff saw as `expectedAmountCents`.

export type RequestBalancePaymentResult =
  | { ok: true; amountCents: number }
  | {
      ok: false;
      reason: "NOT_FOUND" | "NOTHING_DUE" | "AMOUNT_CHANGED" | "MISSING_CUSTOMER_EMAIL" | "EMAIL_FAILED";
      status: number;
      amountCents?: number;
    };

export async function requestOrderBalancePayment(input: {
  orderId: string;
  companyId: string;
  actor: OrderEventActor;
  expectedAmountCents: number;
}): Promise<RequestBalancePaymentResult> {
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
  if (comparison.outcome !== "due") {
    return { ok: false, reason: "NOTHING_DUE", status: 409 };
  }

  const amountCents = Math.round(comparison.differenceIncVatNok * 100);
  if (input.expectedAmountCents !== amountCents) {
    return { ok: false, reason: "AMOUNT_CHANGED", status: 409, amountCents };
  }

  const email = order.email?.trim();
  if (!email) return { ok: false, reason: "MISSING_CUSTOMER_EMAIL", status: 409 };

  // The pay link is built from the action token.
  let actionToken = order.actionToken;
  if (!actionToken) {
    actionToken = createOrderActionToken();
    await prisma.order.update({ where: { id: order.id }, data: { actionToken } });
  }

  const changes = [
    ...comparison.lineChanges.map((change) => describeLineChange(change, "no")),
    ...comparison.detailChanges.map((change) => describeDetailChange(change, "no")),
  ];
  const sent = await sendLifecycleEmailsForOrders({
    orders: [
      {
        ...order,
        email,
        actionToken,
        balanceDue: {
          paidIncVatNok: comparison.totalPaidIncVatNok,
          totalIncVatNok: comparison.currentTotalIncVatNok,
          amountDueIncVatNok: comparison.differenceIncVatNok,
          changes,
        },
      },
    ],
    kind: "balance_due",
    actor: input.actor,
  });
  if (sent.failedOrderIds.length > 0) {
    return { ok: false, reason: "EMAIL_FAILED", status: 502 };
  }

  await createOrderActionEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: input.actor,
    title: `Sent payment request for ${formatKr(comparison.differenceIncVatNok)}`,
    details: changes,
  });

  return { ok: true, amountCents };
}
