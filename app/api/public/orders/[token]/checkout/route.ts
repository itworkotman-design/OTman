import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrderByActionToken, isOrderPayable } from "@/lib/orders/publicOrderAccess";
import { getOrderChargeAmountIncVatNok } from "@/lib/orders/orderTotals";
import { getStripeClient, getOrderActionBaseUrl } from "@/lib/stripe/stripeClient";

// Deliberately creates a brand-new Stripe Checkout Session on every call
// instead of reusing/caching one on the order. Checkout Sessions expire in
// ~24h, but the order itself must stay payable for the full 3-day window —
// so the session is disposable and only ever created just-in-time when the
// customer is actually about to pay.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByActionToken(token);

  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  if (!isOrderPayable(order.status)) {
    return NextResponse.json({ ok: false, reason: "ORDER_NOT_PAYABLE" }, { status: 409 });
  }

  if (!order.email) {
    return NextResponse.json({ ok: false, reason: "MISSING_CUSTOMER_EMAIL" }, { status: 409 });
  }

  const amountIncVatNok = getOrderChargeAmountIncVatNok(order);
  const amountOre = Math.round(amountIncVatNok * 100);

  if (!Number.isFinite(amountOre) || amountOre <= 0) {
    return NextResponse.json({ ok: false, reason: "INVALID_AMOUNT" }, { status: 409 });
  }

  const baseUrl = getOrderActionBaseUrl();
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: order.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "nok",
          unit_amount: amountOre,
          product_data: {
            name: order.displayId ? `Otman bestilling #${order.displayId}` : "Otman bestilling",
            description: order.productsSummary ?? undefined,
          },
        },
      },
    ],
    success_url: `${baseUrl}/betaling/${token}?result=success`,
    cancel_url: `${baseUrl}/betaling/${token}?result=cancelled`,
    metadata: {
      orderId: order.id,
      actionToken: token,
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeCheckoutSessionId: session.id },
  });

  if (!session.url) {
    return NextResponse.json({ ok: false, reason: "STRIPE_SESSION_MISSING_URL" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, url: session.url });
}
