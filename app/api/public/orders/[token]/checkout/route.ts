import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrderByActionToken, isOrderPayable, isTopUpPayable } from "@/lib/orders/publicOrderAccess";
import { getOrderChargeAmountIncVatNok, getOrderRemainingBalanceIncVatNok } from "@/lib/orders/orderTotals";
import { sumOrderPayments } from "@/lib/orders/orderPayments";
import { getStripeClient, getOrderActionBaseUrl } from "@/lib/stripe/stripeClient";

// Deliberately creates a brand-new Stripe Checkout Session on every call
// instead of reusing/caching one on the order. Checkout Sessions expire in
// ~24h, but the order itself must stay payable for the full 3-day window —
// so the session is disposable and only ever created just-in-time when the
// customer is actually about to pay.
//
// Also handles a "top-up" checkout: a confirmed (already paid) order that
// staff have since added items to. In that case the charge is the remaining
// balance (order total minus everything already recorded in OrderPayment),
// not the full total again — see docs/homepage-ordering-roadmap.md §4.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByActionToken(token);

  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const totalPaidCents = sumOrderPayments(order.payments);
  const remainingBalanceIncVatNok = getOrderRemainingBalanceIncVatNok(order, totalPaidCents);
  const isTopUp = isTopUpPayable(order.status, remainingBalanceIncVatNok);

  if (!isOrderPayable(order.status) && !isTopUp) {
    return NextResponse.json({ ok: false, reason: "ORDER_NOT_PAYABLE" }, { status: 409 });
  }

  if (!order.email) {
    return NextResponse.json({ ok: false, reason: "MISSING_CUSTOMER_EMAIL" }, { status: 409 });
  }

  const amountIncVatNok = isTopUp ? remainingBalanceIncVatNok : getOrderChargeAmountIncVatNok(order);
  const amountOre = Math.round(amountIncVatNok * 100);

  if (!Number.isFinite(amountOre) || amountOre <= 0) {
    return NextResponse.json({ ok: false, reason: "INVALID_AMOUNT" }, { status: 409 });
  }

  const baseUrl = getOrderActionBaseUrl();
  const stripe = getStripeClient();

  // Same number the customer sees in every email and on the order pages.
  const orderReference = order.orderNumber?.trim() || order.displayId;
  const orderLabel = orderReference ? `Otman bestilling #${orderReference}` : "Otman bestilling";

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
            name: isTopUp ? `${orderLabel} — tilleggsbetaling` : orderLabel,
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
      // Not read by the webhook's own accounting (that's driven entirely by
      // the OrderPayment ledger + order status, so it's correct either way)
      // — kept for observability/debugging when looking at a session in the
      // Stripe dashboard or an OrderEvent log.
      chargeKind: isTopUp ? "topup" : "initial",
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
