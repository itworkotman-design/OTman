import { prisma } from "@/lib/db";
import { buildOrderStateSnapshot, compareOrderWithPayments, type OrderPaymentComparison, type OrderStateSnapshot } from "./paidOrderSnapshot";
import { isClosedOrderStatus } from "./statusPresentation";
import type { PaymentStatus } from "./manualPayments";
import { formatReceiptNumber } from "@/lib/invoices/receiptSeries";

// A homepage order's Stripe payment history for the Alert Center's Payment
// tab (HOMEPAGE_PAYMENT_MODE=stripe — with manual payments the fakturas are
// the history, lib/invoices/). Every charge from the OrderPayment ledger — the
// first is the booking payment (lib/orders/bookingPayment.ts), later ones a
// paid "My order" change or a top-up — each with its refunds, and paid so far
// against the order now (compareOrderWithPayments).

// A web-sales document: its W-number and when it was emailed.
export type SalesDocumentRef = { number: string; sentAt: string | null };

const documentRef = (number: number | null | undefined, sentAt: Date | null | undefined): SalesDocumentRef | null =>
  number ? { number: formatReceiptNumber(number), sentAt: sentAt?.toISOString() ?? null } : null;

export type StripePaymentEntry = {
  id: string;
  kind: "booking" | "additional";
  amountCents: number;
  stripePaymentIntentId: string | null;
  createdAt: string;
  // Each with its credit note (lib/invoices/refundCreditNotes.ts); null
  // before one was made.
  refunds: { id: string; amountCents: number; reason: string | null; createdAt: string; creditNote: SalesDocumentRef | null }[];
  // Its receipt (lib/invoices/paymentReceipts.ts); null before one was made.
  receipt: SalesDocumentRef | null;
};

export type StripePaymentOverview = {
  // Newest first.
  payments: StripePaymentEntry[];
  comparison: {
    outcome: OrderPaymentComparison["outcome"];
    totalRefundedIncVatNok: number;
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
  receiptNumber?: number | null;
  receiptSentAt?: Date | null;
  refunds: {
    id: string;
    amountRefundedCents: number;
    reason: string | null;
    createdAt: Date;
    orderSnapshot: unknown;
    receiptNumber?: number | null;
    receiptSentAt?: Date | null;
  }[];
};

// `closed`: a cancelled or declined order (isClosedOrderStatus).
export function buildStripePaymentOverview(payments: LedgerPayment[], current: OrderStateSnapshot, closed = false): StripePaymentOverview {
  const oldestFirst = [...payments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const { outcome, totalPaidIncVatNok, totalRefundedIncVatNok, currentTotalIncVatNok, differenceIncVatNok } = compareOrderWithPayments({
    payments,
    current,
    closed,
  });

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
          creditNote: documentRef(refund.receiptNumber, refund.receiptSentAt),
        })),
        receipt: documentRef(payment.receiptNumber, payment.receiptSentAt),
      }))
      .reverse(),
    comparison: { outcome, totalPaidIncVatNok, totalRefundedIncVatNok, currentTotalIncVatNok, differenceIncVatNok },
  };
}

// Order.paymentStatus from how the Stripe payments stand against the order
// now — the booking list's payment badge: pending while more is due, refund
// pending while the customer paid more than the order costs now, otherwise
// paid. Null when nothing was paid yet: a booking still in checkout keeps the
// status it was booked with.
export function nextStripePaymentStatus(outcome: StripePaymentOverview["comparison"]["outcome"]): PaymentStatus | null {
  // Cancelled or declined: the order status says it.
  if (outcome === "unpaid" || outcome === "closed") return null;
  if (outcome === "due") return "pending";
  return outcome === "refund" ? "refund_pending" : "paid";
}

// Null for an order that isn't this company's.
export async function getOrderStripePaymentOverview(orderId: string, companyId: string): Promise<StripePaymentOverview | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    select: {
      status: true,
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
          receiptNumber: true,
          receiptSentAt: true,
          refunds: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              amountRefundedCents: true,
              reason: true,
              createdAt: true,
              orderSnapshot: true,
              receiptNumber: true,
              receiptSentAt: true,
            },
          },
        },
      },
    },
  });
  if (!order) return null;
  return buildStripePaymentOverview(
    order.payments,
    buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] }),
    isClosedOrderStatus(order.status),
  );
}
