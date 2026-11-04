import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrderByActionToken, isOrderPayable, isTopUpPayable } from "@/lib/orders/publicOrderAccess";
import { getOrderChargeAmountIncVatNok, getOrderRemainingBalanceIncVatNok } from "@/lib/orders/orderTotals";
import { sumOrderPayments } from "@/lib/orders/orderPayments";
import { getStripeClient, getOrderActionBaseUrl } from "@/lib/stripe/stripeClient";
import { createOrderCheckoutSession, type OrderChargeKind } from "@/lib/stripe/orderCheckoutSession";
import { isManualPaymentMode } from "@/lib/orders/paymentMode";
import { isAwaitingBookingPayment } from "@/lib/orders/bookingPayment";
import { describeOrderLines } from "@/lib/orders/orderChangeText";

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
//
// And a retry of a booking payment (lib/orders/bookingPayment.ts): a homepage
// order whose customer left Stripe Checkout before paying. That session is
// short-lived too, and replaces the order's earlier one.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  // Homepage orders are paid by faktura until Stripe is connected (lib/invoices/).
  if (isManualPaymentMode()) {
    return NextResponse.json({ ok: false, reason: "PAYMENTS_ARE_MANUAL" }, { status: 409 });
  }

  const { token } = await params;
  const order = await getOrderByActionToken(token);

  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const totalPaidCents = sumOrderPayments(order.payments);
  const remainingBalanceIncVatNok = getOrderRemainingBalanceIncVatNok(order, totalPaidCents);
  const isTopUp = isTopUpPayable(order.status, remainingBalanceIncVatNok, totalPaidCents);
  const isBooking = isAwaitingBookingPayment(order);

  if (!isOrderPayable(order.status) && !isTopUp && !isBooking) {
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

  const chargeKind: OrderChargeKind = isBooking ? "booking" : isTopUp ? "topup" : "initial";
  const session = await createOrderCheckoutSession(getStripeClient(), {
    order: { ...order, email: order.email },
    itemLines: describeOrderLines(order, "no"),
    token,
    amountIncVatNok,
    chargeKind,
    baseUrl: getOrderActionBaseUrl(),
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
