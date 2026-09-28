import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import { createOrderActionEvent, createOrderStatusChangedEvent } from "@/lib/orders/orderEvents";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { recordOrderPayment, sumOrderPayments } from "@/lib/orders/orderPayments";
import { sendLifecycleEmailsForOrders } from "@/lib/orders/sendCustomerLifecycleEmail";

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    return;
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
    },
  });

  if (!order) {
    return;
  }

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
  });
  if (!payment) {
    return;
  }

  const payments = await prisma.orderPayment.findMany({
    where: { orderId: order.id },
    select: { amountChargedCents: true },
  });
  const totalPaidCents = sumOrderPayments(payments);

  const wasAlreadyConfirmed = normalizeOrderStatus(order.status) === "confirmed";

  await prisma.order.update({
    where: { id: order.id },
    data: {
      // Only the first payment moves the order to "confirmed" — a top-up
      // payment on an order that's already confirmed leaves status alone.
      status: wasAlreadyConfirmed ? undefined : "confirmed",
      stripePaymentIntentId: paymentIntentId,
      // Kept as a "total paid so far" convenience snapshot for existing
      // readers of this field — OrderPayment is the source of truth.
      stripeAmountChargedCents: totalPaidCents,
    },
  });

  if (wasAlreadyConfirmed) {
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
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ ok: false, reason: "UNCONFIGURED" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ ok: false, reason: "INVALID_SIGNATURE" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
    }
  } catch (error) {
    console.error("Failed to process Stripe webhook event", event.type, error);
    return NextResponse.json({ ok: false, reason: "PROCESSING_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
