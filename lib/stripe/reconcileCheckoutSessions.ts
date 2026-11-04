import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { handleCheckoutSessionCompleted, handleCheckoutSessionExpired } from "@/lib/stripe/checkoutSessionHandlers";
import { alertStaff } from "@/lib/orders/staffAlerts";

// The safety net under Stripe's webhook (app/api/cron/stripe-reconcile): for
// recent homepage orders whose latest checkout session has no recorded
// payment, ask Stripe how that session ended. Paid → record it exactly as the
// webhook would (checkoutSessionHandlers.ts) and alert staff that it came in
// late; expired → run the expiry (an unpaid booking is cancelled). A webhook
// that never arrives — Stripe down, a misconfigured endpoint, the local
// `stripe listen` not running — no longer leaves a paid order "pending".
// Both handlers are idempotent, so racing the webhook is harmless; sessions
// younger than RECONCILE_MIN_AGE_MINUTES are left to it anyway.

export const RECONCILE_LOOKBACK_DAYS = 7;
export const RECONCILE_MIN_AGE_MINUTES = 10;
// Stripe API calls per run.
const MAX_SESSIONS = 50;

type StripeSessions = { checkout: { sessions: Pick<Stripe["checkout"]["sessions"], "retrieve"> } };

export type ReconcileSummary = { checked: number; recovered: number; expired: number; failed: number };

export async function reconcileCheckoutSessions(input: { stripe: StripeSessions; now?: Date }): Promise<ReconcileSummary> {
  const now = input.now ?? new Date();
  const summary: ReconcileSummary = { checked: 0, recovered: 0, expired: 0, failed: 0 };

  const orders = await prisma.order.findMany({
    where: {
      isWebsiteOrder: true,
      stripeCheckoutSessionId: { not: null },
      updatedAt: { gte: new Date(now.getTime() - RECONCILE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, companyId: true, stripeCheckoutSessionId: true, payments: { select: { stripeCheckoutSessionId: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const unrecorded = orders.filter(
    (order) => order.stripeCheckoutSessionId && !order.payments.some((payment) => payment.stripeCheckoutSessionId === order.stripeCheckoutSessionId),
  );
  const minCreated = Math.floor((now.getTime() - RECONCILE_MIN_AGE_MINUTES * 60_000) / 1000);

  for (const order of unrecorded.slice(0, MAX_SESSIONS)) {
    summary.checked += 1;
    try {
      const session = await input.stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId as string);
      if (session.created > minCreated) continue;
      // A paid "My order" change settles through its own flow (customerOrderPaidChange.ts).
      if (session.metadata?.pendingChangeId) continue;

      if (session.payment_status === "paid") {
        if (await handleCheckoutSessionCompleted(session)) {
          summary.recovered += 1;
          await alertStaff({
            orderId: order.id,
            companyId: order.companyId,
            title: "Stripe payment recorded late",
            message: `Stripe checkout ${session.id} was paid (${((session.amount_total ?? 0) / 100).toLocaleString("nb-NO")} kr), but its webhook never reached the app. It has now been recorded — check the order and the Stripe webhook settings.`,
          });
        }
      } else if (session.status === "expired") {
        await handleCheckoutSessionExpired(session);
        summary.expired += 1;
      }
    } catch (error) {
      // A session this Stripe account doesn't have (made with other keys,
      // e.g. a different sandbox) can't be reconciled — not a failure.
      if ((error as { code?: string })?.code === "resource_missing") continue;
      summary.failed += 1;
      console.error("[stripe reconcile] Failed for order", order.id, error instanceof Error ? error.message : error);
    }
  }
  return summary;
}
