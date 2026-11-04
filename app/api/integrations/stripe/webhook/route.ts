import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import { handleCheckoutSessionCompleted, handleCheckoutSessionExpired } from "@/lib/stripe/checkoutSessionHandlers";
import { alertStaff } from "@/lib/orders/staffAlerts";

// Stripe's webhook: a checkout session completed (paid) or expired. What each
// does to the order lives in lib/stripe/checkoutSessionHandlers.ts.

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
    } else if (event.type === "checkout.session.expired") {
      await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
    }
  } catch (error) {
    console.error("Failed to process Stripe webhook event", event.type, error);
    // A paid order whose payment didn't get recorded: staff see it on the
    // order. Stripe retries (500), and the reconciliation cron catches it too.
    const session = event.data.object as Stripe.Checkout.Session;
    if (event.type === "checkout.session.completed" && session.metadata?.orderId) {
      await alertStaff({
        orderId: session.metadata.orderId,
        title: "Stripe payment not recorded yet",
        message: `Stripe reported checkout ${session.id} as paid (${((session.amount_total ?? 0) / 100).toLocaleString("nb-NO")} kr), but saving it failed: ${error instanceof Error ? error.message.slice(0, 200) : "unknown error"}. Stripe retries automatically; check the Payment tab later.`,
      });
    }
    return NextResponse.json({ ok: false, reason: "PROCESSING_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
