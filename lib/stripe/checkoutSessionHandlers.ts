// What a finished Stripe Checkout session does to its order — shared by the
// webhook (app/api/integrations/stripe/webhook) and the reconciliation cron
// (lib/stripe/reconcileCheckoutSessions.ts), which catches sessions whose
// webhook never arrived. Both handlers are idempotent: a payment is keyed on
// its checkout session (recordOrderPayment), an expiry only cancels an order
// still awaiting that very session.
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { createOrderActionEvent, createOrderStatusChangedEvent } from "@/lib/orders/orderEvents";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { recordOrderPayment, sumOrderPayments } from "@/lib/orders/orderPayments";
import { sendLifecycleEmailsForOrders } from "@/lib/orders/sendCustomerLifecycleEmail";
import { buildOrderStateSnapshot } from "@/lib/orders/paidOrderSnapshot";
import { applyPaidChange } from "@/lib/customerAccounts/customerOrderPaidChange";
import { isAwaitingBookingPayment } from "@/lib/orders/bookingPayment";
import { cancelUnpaidBookingOrder, welcomePaidBookingOrder } from "@/lib/orders/bookingCheckout";

const ALREADY_CONFIRMED = new Set(["confirmed", "active", "completed"]);

// True when this call recorded a new payment (false: a paid "My order" change,
// an unknown order, or a session already recorded).
export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<boolean> {
  // A paid "My order" change: applied (or refunded) there, status untouched.
  if (session.metadata?.pendingChangeId) {
    await applyPaidChange(session);
    return false;
  }

  const orderId = session.metadata?.orderId;
  if (!orderId) {
    return false;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      companyId: true,
      status: true,
      displayId: true,
      orderNumber: true,
      customerName: true,
      customerLabel: true,
      statusNotes: true,
      actionToken: true,
      email: true,
      emailThreadToken: true,
      // What the payment covered — stored on the OrderPayment below.
      priceExVat: true,
      rabatt: true,
      leggTil: true,
      pricingSnapshot: true,
      websiteOrderKind: true,
      websiteBookingDetails: true,
      pickupAddress: true,
      deliveryAddress: true,
      extraPickupAddress: true,
      deliveryDate: true,
      timeWindow: true,
      drivingDistance: true,
      paymentStatus: true,
      payments: { select: { id: true } },
    },
  });

  if (!order) {
    return false;
  }

  // Paid as it was placed on the homepage (lib/orders/bookingPayment.ts):
  // stays processing for staff to confirm.
  const isBookingPayment = isAwaitingBookingPayment(order);

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  // Idempotency: keyed on the Stripe checkout session itself (OrderPayment's
  // unique stripeCheckoutSessionId), not on order status — an order can be
  // paid in more than one pass (the original total, then a later top-up once
  // staff add items to an already-"confirmed" order), and a status-based
  // guard would silently swallow that second, legitimate payment. Returns
  // null (nothing to do) if Stripe redelivered an event for a session
  // already recorded, or the customer reloaded the success page.
  const payment = await recordOrderPayment(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    amountChargedCents: session.amount_total ?? 0,
    // The order as it is when the payment lands. Admin edits are compared
    // against this (see compareOrderWithPayments).
    orderSnapshot: buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] }),
  });
  if (!payment) {
    return false;
  }

  const payments = await prisma.orderPayment.findMany({
    where: { orderId: order.id },
    select: { amountChargedCents: true, refunds: { select: { amountRefundedCents: true } } },
  });
  const totalPaidCents = sumOrderPayments(payments);

  // Confirmed or further along (on its way, done): a top-up never moves an
  // order back to "confirmed". Nor does any payment on a processing order —
  // paid at booking, it waits for staff to confirm it.
  const normalizedStatus = normalizeOrderStatus(order.status);
  const wasAlreadyConfirmed = ALREADY_CONFIRMED.has(normalizedStatus);
  const keepsStatus = wasAlreadyConfirmed || normalizedStatus === "processing";

  await prisma.order.update({
    where: { id: order.id },
    data: {
      // Only the first payment moves the order to "confirmed" — a top-up
      // payment on an order that's already confirmed leaves status alone.
      status: keepsStatus ? undefined : "confirmed",
      paymentStatus: "paid",
      stripePaymentIntentId: paymentIntentId,
      // Kept as a "total paid so far" convenience snapshot for existing
      // readers of this field — OrderPayment is the source of truth.
      stripeAmountChargedCents: totalPaidCents,
    },
  });

  if (isBookingPayment) {
    await createOrderActionEvent(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      actor: { source: "SYSTEM", name: "Stripe" },
      title: "Payment received via Stripe",
      details: [`${((session.amount_total ?? 0) / 100).toLocaleString("nb-NO")} kr — paid at booking.`],
    });

    // Best-effort, like the order-confirmed email below: the payment is
    // recorded either way, and staff can resend the login from the order.
    try {
      await welcomePaidBookingOrder(order.id);
    } catch (error) {
      console.error("[stripe webhook] Failed to welcome the customer of a paid booking", order.id, error);
    }
  } else if (keepsStatus) {
    await createOrderActionEvent(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      actor: { source: "SYSTEM", name: "Stripe" },
      title: "Additional payment received via Stripe",
      details: [
        `${((session.amount_total ?? 0) / 100).toLocaleString("nb-NO")} kr — total paid now ${(totalPaidCents / 100).toLocaleString("nb-NO")} kr.`,
      ],
    });
  } else {
    await createOrderStatusChangedEvent(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      actor: { source: "SYSTEM", name: "Stripe" },
      fromStatus: order.status,
      toStatus: "confirmed",
      note: "Payment completed via Stripe.",
    });

    // Best-effort: a failed send here must never fail the webhook response —
    // the payment is already correctly recorded regardless, and Stripe
    // retrying the whole webhook on a 500 here would re-run everything above
    // needlessly (though harmlessly, since recordOrderPayment is itself
    // idempotent). Only the FIRST payment sends this — see
    // docs/homepage-ordering-roadmap.md §4 for why a confirmed order
    // otherwise has no customer-facing email at all, which left the
    // request-change/add-items link unreachable.
    if (order.email) {
      try {
        await sendLifecycleEmailsForOrders({
          orders: [{ ...order, companyId: order.companyId }],
          kind: "order_confirmed",
          actor: { source: "SYSTEM", name: "Stripe" },
        });
      } catch (error) {
        console.error("[stripe webhook] Failed to send order-confirmed email", order.id, error);
      }
    }
  }
  return true;
}

// A booking checkout (lib/orders/bookingPayment.ts) that expired unpaid
// cancels its order — unless the customer has since opened a newer session
// from the payment page, which then decides.
export async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId || session.metadata?.chargeKind !== "booking") {
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      companyId: true,
      displayId: true,
      status: true,
      paymentStatus: true,
      stripeCheckoutSessionId: true,
      subcontractorMembershipId: true,
      subcontractor: true,
      payments: { select: { id: true } },
    },
  });
  if (!order || order.stripeCheckoutSessionId !== session.id || !isAwaitingBookingPayment(order)) {
    return;
  }

  await cancelUnpaidBookingOrder(order, {
    sessionId: session.id,
    note: "Not paid: the Stripe checkout expired.",
  });
}
