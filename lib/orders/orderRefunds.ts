import { Prisma } from "@prisma/client";

// Sends money back to a website-order customer through Stripe. Every refund is
// made against one recorded OrderPayment (a Stripe refund always targets one
// payment intent) and written to the OrderRefund ledger, so "how much can
// still be refunded" is always charges minus refunds — never a guess.
//
// A refund spanning several payments (the original charge plus top-ups)
// takes from the newest payment first.

export type RefundablePayment = {
  id: string;
  stripePaymentIntentId: string | null;
  amountChargedCents: number;
  createdAt: Date;
  refunds: { amountRefundedCents: number }[];
};

export type RefundAllocation = {
  paymentId: string;
  paymentIntentId: string;
  amountCents: number;
  // Part of the Stripe idempotency key: a retry of the same refund reuses it,
  // a later refund on the same payment gets a new one.
  alreadyRefundedCents: number;
};

export type RefundPlan =
  | { ok: true; totalCents: number; allocations: RefundAllocation[] }
  | { ok: false; reason: "INVALID_AMOUNT" | "NOTHING_TO_REFUND" | "EXCEEDS_REFUNDABLE" | "MISSING_PAYMENT_INTENT" };

function refundedCents(payment: RefundablePayment) {
  return payment.refunds.reduce((sum, refund) => sum + refund.amountRefundedCents, 0);
}

export function sumRefundableCents(payments: RefundablePayment[]): number {
  return payments.reduce((sum, payment) => sum + payment.amountChargedCents - refundedCents(payment), 0);
}

export function planOrderRefund(payments: RefundablePayment[], amountCents: number | "ALL"): RefundPlan {
  if (amountCents !== "ALL" && (!Number.isInteger(amountCents) || amountCents <= 0)) {
    return { ok: false, reason: "INVALID_AMOUNT" };
  }

  const refundable = sumRefundableCents(payments);
  if (refundable <= 0) return { ok: false, reason: "NOTHING_TO_REFUND" };

  const target = amountCents === "ALL" ? refundable : amountCents;
  if (target > refundable) return { ok: false, reason: "EXCEEDS_REFUNDABLE" };

  const newestFirst = [...payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const allocations: RefundAllocation[] = [];
  let remaining = target;

  for (const payment of newestFirst) {
    if (remaining <= 0) break;
    const alreadyRefundedCents = refundedCents(payment);
    const left = payment.amountChargedCents - alreadyRefundedCents;
    if (left <= 0) continue;
    if (!payment.stripePaymentIntentId) return { ok: false, reason: "MISSING_PAYMENT_INTENT" };

    const amount = Math.min(left, remaining);
    allocations.push({ paymentId: payment.id, paymentIntentId: payment.stripePaymentIntentId, amountCents: amount, alreadyRefundedCents });
    remaining -= amount;
  }

  return { ok: true, totalCents: target, allocations };
}

// The narrow slices of Prisma and Stripe this needs — keeps it testable
// without either.
type RefundClient = {
  orderPayment: {
    findMany(args: {
      where: { orderId: string };
      select: {
        id: true;
        stripePaymentIntentId: true;
        amountChargedCents: true;
        createdAt: true;
        refunds: { select: { amountRefundedCents: true } };
      };
    }): Promise<RefundablePayment[]>;
  };
  orderRefund: {
    create(args: {
      data: {
        orderId: string;
        companyId: string;
        orderPaymentId: string;
        stripeRefundId: string;
        amountRefundedCents: number;
        reason: string | null;
      };
    }): Promise<unknown>;
  };
};

type StripeRefunds = {
  refunds: {
    create(
      params: { payment_intent: string; amount: number; metadata: Record<string, string> },
      options: { idempotencyKey: string },
    ): Promise<{ id: string }>;
  };
};

export type RefundResult =
  | { ok: true; refundedCents: number }
  | { ok: false; reason: Exclude<RefundPlan, { ok: true }>["reason"] }
  // Some refunds may have gone through before the failure (refundedCents);
  // they're in the ledger, so retrying only refunds what's left.
  | { ok: false; reason: "STRIPE_ERROR"; refundedCents: number };

export async function refundOrderPayments(
  client: RefundClient,
  stripe: StripeRefunds,
  params: { orderId: string; companyId: string; amountCents: number | "ALL"; reason?: string | null },
): Promise<RefundResult> {
  const payments = await client.orderPayment.findMany({
    where: { orderId: params.orderId },
    select: {
      id: true,
      stripePaymentIntentId: true,
      amountChargedCents: true,
      createdAt: true,
      refunds: { select: { amountRefundedCents: true } },
    },
  });

  const plan = planOrderRefund(payments, params.amountCents);
  if (!plan.ok) return plan;

  let refundedCentsSoFar = 0;
  for (const allocation of plan.allocations) {
    let refundId: string;
    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: allocation.paymentIntentId,
          amount: allocation.amountCents,
          metadata: { orderId: params.orderId, orderPaymentId: allocation.paymentId },
        },
        {
          idempotencyKey: `order-refund:${allocation.paymentId}:${allocation.alreadyRefundedCents}:${allocation.amountCents}`,
        },
      );
      refundId = refund.id;
    } catch (error) {
      console.error("[orderRefunds] Stripe refund failed", params.orderId, allocation.paymentId, error);
      return { ok: false, reason: "STRIPE_ERROR", refundedCents: refundedCentsSoFar };
    }

    try {
      await client.orderRefund.create({
        data: {
          orderId: params.orderId,
          companyId: params.companyId,
          orderPaymentId: allocation.paymentId,
          stripeRefundId: refundId,
          amountRefundedCents: allocation.amountCents,
          reason: params.reason?.trim() || null,
        },
      });
    } catch (error) {
      // P2002 on stripeRefundId: a retry got the same refund back from Stripe
      // (idempotency key) and it's already recorded.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
    refundedCentsSoFar += allocation.amountCents;
  }

  return { ok: true, refundedCents: refundedCentsSoFar };
}
