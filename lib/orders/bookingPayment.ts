import { normalizeOrderStatus } from "./statusPresentation";

// Paying at booking (HOMEPAGE_PAYMENT_MODE=stripe): a homepage order is saved
// "processing" with paymentStatus "pending" and the customer is sent straight
// to Stripe Checkout. The Stripe webhook marks it "paid" (status stays
// processing for staff to confirm), or cancels it when the checkout expires.
// See lib/orders/bookingCheckout.ts.
export function isAwaitingBookingPayment(order: {
  status: string | null | undefined;
  paymentStatus: string | null | undefined;
  payments: unknown[];
}): boolean {
  return (
    normalizeOrderStatus(order.status) === "processing" && order.paymentStatus === "pending" && order.payments.length === 0
  );
}
