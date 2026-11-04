import { prisma } from "@/lib/db";
import {
  ORDER_STATE_SOURCE_SELECT,
  buildOrderStateSnapshot,
  compareOrderWithPayments,
  diffOrderStates,
  type OrderStateSnapshot,
} from "@/lib/orders/paidOrderSnapshot";
import { ORDER_PAYMENT_LEDGER_SELECT } from "@/lib/orders/orderPayments";
import { isManualPaymentMode } from "@/lib/orders/paymentMode";
import { isClosedOrderStatus } from "@/lib/orders/statusPresentation";
import { requestOrderBalancePayment } from "@/lib/orders/requestOrderBalancePayment";
import { describeDetailChange, describeLineChange } from "@/lib/orders/orderChangeText";
import type { OrderEventActor } from "@/lib/orders/orderEvents";
import { sendLifecycleEmailsForOrders } from "@/lib/orders/sendCustomerLifecycleEmail";

// After staff save a change to a website order in the dashboard (the
// website-items, moving-details and service-details routes): the customer
// gets the "order updated" email — what changed and the new total, worded as
// a change we made — unless staff ticked "Don't email the customer". Compares
// the order before the save (`before`) with the order as saved; a save that
// changed nothing the customer sees (lines, stops, dates) sends nothing.
// A Stripe-paid order that now costs more than was paid gets one email
// instead: the payment request (requestOrderBalancePayment.ts — what changed,
// the new total, the amount due and the pay link).
//
// Never throws: the order is already saved, so a failed email is reported
// ("failed"), not turned into an error.

export type StaffEditEmailResult = "sent" | "sent_payment_request" | "failed" | "no_changes" | "no_email";

export async function sendStaffEditCustomerEmail(input: {
  orderId: string;
  companyId: string;
  before: OrderStateSnapshot;
  actor: OrderEventActor;
}): Promise<StaffEditEmailResult> {
  try {
    const order = await prisma.order.findFirst({
      where: { id: input.orderId, companyId: input.companyId },
      select: {
        ...ORDER_STATE_SOURCE_SELECT,
        id: true,
        companyId: true,
        displayId: true,
        orderNumber: true,
        status: true,
        customerName: true,
        customerLabel: true,
        statusNotes: true,
        actionToken: true,
        email: true,
        emailThreadToken: true,
        payments: { select: ORDER_PAYMENT_LEDGER_SELECT },
      },
    });
    if (!order) return "failed";
    const email = order.email?.trim();
    if (!email) return "no_email";

    const after = buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] });
    const diff = diffOrderStates(input.before, after);
    const changes = [
      ...diff.lineChanges.map((change) => describeLineChange(change, "no")),
      ...diff.detailChanges.map((change) => describeDetailChange(change, "no")),
    ];
    if (changes.length === 0) return "no_changes";

    // Paid by Stripe and now owing more: one email with the pay link.
    const payments = order.payments ?? [];
    if (!isManualPaymentMode() && payments.length > 0) {
      const comparison = compareOrderWithPayments({ payments, current: after, closed: isClosedOrderStatus(order.status) });
      if (comparison.outcome === "due") {
        const requested = await requestOrderBalancePayment({
          orderId: order.id,
          companyId: order.companyId,
          actor: input.actor,
          expectedAmountCents: Math.round(comparison.differenceIncVatNok * 100),
        });
        return requested.ok ? "sent_payment_request" : "failed";
      }
    }

    const sent = await sendLifecycleEmailsForOrders({
      orders: [
        {
          ...order,
          email,
          orderUpdate: { changes, totalIncVatNok: order.priceExVat > 0 ? after.totalIncVatNok : null, byStaff: true },
        },
      ],
      kind: "order_updated",
      actor: input.actor,
    });
    return sent.failedOrderIds.length > 0 ? "failed" : "sent";
  } catch (error) {
    console.error("[staff edit email] Failed to email the customer about a change", input.orderId, error);
    return "failed";
  }
}
