import { Prisma, type PrismaClient } from "@prisma/client";
import type { OrderStateSnapshot } from "./paidOrderSnapshot";

// Any Prisma client or transaction handle that can write OrderPayment rows —
// same "generic client" shape lib/orders/orderEvents.ts uses, so this
// composes inside the same $transaction as the rest of a webhook/order write.
type OrderPaymentClient = Pick<PrismaClient, "orderPayment">;

export type OrderPaymentTotal = { amountChargedCents: number; refunds: { amountRefundedCents: number }[] };

// What every reader of an order's payments selects: each charge with the
// refunds made against it (lib/orders/orderRefunds.ts), so "paid" is always
// net of what went back. `refunds` is required by the types above and in
// paidOrderSnapshot.ts, so a query that forgets it doesn't compile.
export const ORDER_PAYMENT_LEDGER_SELECT = {
  amountChargedCents: true,
  createdAt: true,
  orderSnapshot: true,
  refunds: { select: { amountRefundedCents: true, createdAt: true, orderSnapshot: true } },
} as const;

// Source of truth for "how much has actually been paid on this order so
// far" — sum every recorded charge, minus every refund, rather than trusting
// a single scalar field, since an order can be paid in more than one pass
// (see docs/homepage-ordering-roadmap.md §4).
export function sumOrderPayments(payments: OrderPaymentTotal[]): number {
  return payments.reduce(
    (sum, payment) =>
      sum + payment.amountChargedCents - payment.refunds.reduce((refunded, refund) => refunded + refund.amountRefundedCents, 0),
    0,
  );
}

export async function recordOrderPayment(
  client: OrderPaymentClient,
  params: {
    orderId: string;
    companyId: string;
    stripeCheckoutSessionId: string;
    stripePaymentIntentId: string | null;
    amountChargedCents: number;
    // What this payment covered (see paidOrderSnapshot.ts) — compared later
    // against the order as it is then, so every change has a clear "before".
    orderSnapshot?: OrderStateSnapshot | null;
  },
) {
  try {
    return await client.orderPayment.create({
      data: {
        orderId: params.orderId,
        companyId: params.companyId,
        stripeCheckoutSessionId: params.stripeCheckoutSessionId,
        stripePaymentIntentId: params.stripePaymentIntentId,
        amountChargedCents: params.amountChargedCents,
        ...(params.orderSnapshot ? { orderSnapshot: params.orderSnapshot as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  } catch (error) {
    // P2002 = unique constraint violation on stripeCheckoutSessionId — this
    // exact charge was already recorded (Stripe redelivering the same
    // webhook event, or the customer reloading the success page). Treat as
    // "nothing to do" rather than an error: this is the idempotency guard
    // itself, deliberately keyed on the Stripe session rather than on order
    // status (a status-based guard would silently swallow a legitimate
    // second/top-up payment on an already-"confirmed" order).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }
    throw error;
  }
}
