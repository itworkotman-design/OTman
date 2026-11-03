import type Stripe from "stripe";

// "initial": an approved order's full total (payment link). "topup": what a
// confirmed order still owes after staff added to it. "booking": a homepage
// order paid as it is placed (lib/orders/bookingCheckout.ts) — short-lived, so
// an unpaid order is cancelled soon after (checkout.session.expired webhook).
export type OrderChargeKind = "initial" | "topup" | "booking";

// Stripe refuses an expiry under 30 minutes; one spare minute for clock drift.
export const BOOKING_CHECKOUT_MINUTES = 31;

type CheckoutOrder = {
  id: string;
  email: string;
  orderNumber?: string | null;
  displayId?: number | null;
  productsSummary?: string | null;
};

type StripeWithCheckout = { checkout: { sessions: Pick<Stripe["checkout"]["sessions"], "create"> } };

export function createOrderCheckoutSession(
  stripe: StripeWithCheckout,
  params: {
    order: CheckoutOrder;
    token: string;
    amountIncVatNok: number;
    chargeKind: OrderChargeKind;
    baseUrl: string;
    now?: Date;
  },
) {
  const { order, token, chargeKind, baseUrl } = params;
  // Same number the customer sees in every email and on the order pages.
  const orderReference = order.orderNumber?.trim() || order.displayId;
  const orderLabel = orderReference ? `Otman bestilling #${orderReference}` : "Otman bestilling";
  const now = params.now ?? new Date();

  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: order.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "nok",
          unit_amount: Math.round(params.amountIncVatNok * 100),
          product_data: {
            name: chargeKind === "topup" ? `${orderLabel} — tilleggsbetaling` : orderLabel,
            description: order.productsSummary ?? undefined,
          },
        },
      },
    ],
    ...(chargeKind === "booking"
      ? { expires_at: Math.floor(now.getTime() / 1000) + BOOKING_CHECKOUT_MINUTES * 60 }
      : {}),
    success_url: `${baseUrl}/betaling/${token}?result=success`,
    cancel_url: `${baseUrl}/betaling/${token}?result=cancelled`,
    metadata: {
      orderId: order.id,
      actionToken: token,
      // "booking" is what the webhook's expiry handler acts on; otherwise only
      // for observability (the payment accounting is driven by the
      // OrderPayment ledger + order status, so it's correct either way).
      chargeKind,
    },
  });
}
