import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import { createOrderStatusChangedEvent } from "@/lib/orders/orderEvents";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, companyId: true, status: true },
  });

  if (!order) {
    return;
  }

  // Idempotency: Stripe can redeliver the same event, and a customer can
  // revisit the pay page after already completing payment.
  if (normalizeOrderStatus(order.status) === "confirmed") {
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "confirmed",
      stripePaymentIntentId: paymentIntentId,
      stripeAmountChargedCents: session.amount_total ?? null,
    },
  });

  await createOrderStatusChangedEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: { source: "SYSTEM", name: "Stripe" },
    fromStatus: order.status,
    toStatus: "confirmed",
    note: "Payment completed via Stripe.",
  });
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
