import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

// The payment badge on "My order" (Order.paymentStatus as the customer sees
// it): paid, waiting for payment — with a link to the pay page
// (/betaling/[token]) while payments go through Stripe — or a refund on its
// way (refund_pending: they paid more than the order costs now). Nothing for
// an order without a payment status, or one that's cancelled or refunded:
// the progress bar says what happens to the money there.

export type CustomerPaymentState = { kind: "paid" | "due" | "refund"; payPath: string | null };

const CLOSED = new Set(["cancelled", "refunded"]);

export function customerPaymentState(
  order: { status: string | null; paymentStatus: string | null; actionToken: string | null },
  options: { stripe: boolean },
): CustomerPaymentState | null {
  if (CLOSED.has(normalizeOrderStatus(order.status))) return null;
  if (order.paymentStatus === "paid") return { kind: "paid", payPath: null };
  if (order.paymentStatus === "refund_pending") return { kind: "refund", payPath: null };
  if (order.paymentStatus === "pending") {
    return { kind: "due", payPath: options.stripe && order.actionToken ? `/betaling/${order.actionToken}` : null };
  }
  return null;
}
