import { prisma } from "@/lib/db";
import { buildOrderStateSnapshot, compareOrderWithPayments, type OrderStateSnapshot } from "./paidOrderSnapshot";
import type { PaymentStatus } from "./manualPayments";

// A homepage order's Stripe payment history for the Alert Center's Payment
// tab (HOMEPAGE_PAYMENT_MODE=stripe — with manual payments the fakturas are
// the history, lib/invoices/). Every charge from the OrderPayment ledger — the
// first is the booking payment (lib/orders/bookingPayment.ts), later ones a
// paid "My order" change or a top-up — each with its refunds, and paid so far
// against the order now (compareOrderWithPayments).

export type StripePaymentEntry = {
  id: string;
  kind: "booking" | "additional";
  amountCents: number;
  stripePaymentIntentId: string | null;
  createdAt: string;
  refunds: { id: string; amountCents: number; reason: string | null; createdAt: string }[];
};

export type StripePaymentOverview = {
  // Newest first.
  payments: StripePaymentEntry[];
  comparison: {
    outcome: "unpaid" | "due" | "refund" | "settled";
    totalPaidIncVatNok: number;
    currentTotalIncVatNok: number;
    differenceIncVatNok: number;
  };
};

type LedgerPayment = {
  id: string;
  amountChargedCents: number;
  stripePaymentIntentId: string | null;
  createdAt: Date;
  orderSnapshot: unknown;
  refunds: { id: string; amountRefundedCents: number; reason: string | null; createdAt: Date; orderSnapshot: unknown }[];
};

export function buildStripePaymentOverview(payments: LedgerPayment[], current: OrderStateSnapshot): StripePaymentOverview {
  const oldestFirst = [...payments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const { outcome, totalPaidIncVatNok, currentTotalIncVatNok, differenceIncVatNok } = compareOrderWithPayments({ payments, current });

  return {
    payments: oldestFirst
      .map((payment, index) => ({
        id: payment.id,
        kind: index === 0 ? ("booking" as const) : ("additional" as const),
        amountCents: payment.amountChargedCents,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        createdAt: payment.createdAt.toISOString(),
        refunds: payment.refunds.map((refund) => ({
          id: refund.id,
          amountCents: refund.amountRefundedCents,
          reason: refund.reason,
          createdAt: refund.createdAt.toISOString(),
        })),
      }))
      .reverse(),
    comparison: { outcome, totalPaidIncVatNok, currentTotalIncVatNok, differenceIncVatNok },
  };
}

// Order.paymentStatus from how the Stripe payments stand against the order
// now — the booking list's payment badge: pending while more is due, refund
// pending while the customer paid more than the order costs now, otherwise
// paid. Null when nothing was paid yet: a booking still in checkout keeps the
// status it was booked with.
export function nextStripePaymentStatus(outcome: StripePaymentOverview["comparison"]["outcome"]): PaymentStatus | null {
  if (outcome === "unpaid") return null;
  if (outcome === "due") return "pending";
  return outcome === "refund" ? "refund_pending" : "paid";
}

// Null for an order that isn't this company's.
export async function getOrderStripePaymentOverview(orderId: string, companyId: string): Promise<StripePaymentOverview | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    select: {
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
      payments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          amountChargedCents: true,
          stripePaymentIntentId: true,
          createdAt: true,
          orderSnapshot: true,
          refunds: {
            orderBy: { createdAt: "asc" },
            select: { id: true, amountRefundedCents: true, reason: true, createdAt: true, orderSnapshot: true },
          },
        },
      },
    },
  });
  if (!order) return null;
  return buildStripePaymentOverview(order.payments, buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] }));
}
