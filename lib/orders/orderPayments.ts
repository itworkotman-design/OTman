import { Prisma, type PrismaClient } from "@prisma/client";

// Any Prisma client or transaction handle that can write OrderPayment rows —
// same "generic client" shape lib/orders/orderEvents.ts uses, so this
// composes inside the same $transaction as the rest of a webhook/order write.
type OrderPaymentClient = Pick<PrismaClient, "orderPayment">;

export type OrderPaymentTotal = { amountChargedCents: number };

// Source of truth for "how much has actually been paid on this order so
// far" — sum every recorded charge rather than trusting a single scalar
// field, since an order can be paid in more than one pass (see
// docs/homepage-ordering-roadmap.md §4).
export function sumOrderPayments(payments: OrderPaymentTotal[]): number {
  return payments.reduce((sum, payment) => sum + payment.amountChargedCents, 0);
}

export async function recordOrderPayment(
  client: OrderPaymentClient,
  params: {
    orderId: string;
    companyId: string;
    stripeCheckoutSessionId: string;
    stripePaymentIntentId: string | null;
    amountChargedCents: number;
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
