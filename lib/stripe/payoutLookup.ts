import { getOsloDateKey } from "@/lib/dates/isoDate";
import { roundNok } from "@/lib/orders/orderTotals";
import type { StripeSettlement, StripeSettlementLookup } from "@/lib/invoices/webSalesReport";

// For the monthly web-sales report (lib/invoices/webSalesReport.ts): which
// Stripe payout each charge and refund went out in, and Stripe's fee on it.
// Stripe doesn't say this on the charge itself, so we walk the payouts made
// from the month's start until a few weeks after it (or now) and read each
// payout's balance transactions. Also the payouts that reached the bank in
// the month — what the bank statement shows.

// How long after the month's end a payout of its payments is looked for.
const PAYOUT_WINDOW_MS = 35 * 24 * 60 * 60 * 1000;

type Source = { id: string; object: string; payment_intent?: string | { id: string } | null } | string | null;
type Payout = { id: string; arrival_date: number; amount: number; status: string };
type BalanceTransaction = { type: string; fee: number; source: Source };

// The slice of the Stripe client this needs (list calls auto-paginate when
// iterated).
export type StripePayoutClient = {
  payouts: {
    list(
      params: { created: { gte: number; lte: number }; limit: number } | { arrival_date: { gte: number; lt: number }; limit: number },
    ): AsyncIterable<Payout>;
  };
  balanceTransactions: {
    list(params: { payout: string; limit: number; expand: string[] }): AsyncIterable<BalanceTransaction>;
  };
};

const unix = (date: Date) => Math.floor(date.getTime() / 1000);
const arrivalDate = (payout: Payout) => getOsloDateKey(new Date(payout.arrival_date * 1000));
const SKIPPED_STATUSES = new Set(["failed", "canceled"]);

export async function fetchStripeSettlements(
  stripe: StripePayoutClient,
  range: { from: Date; to: Date; now?: Date },
): Promise<StripeSettlementLookup> {
  const now = range.now ?? new Date();
  const until = new Date(Math.min(range.to.getTime() + PAYOUT_WINDOW_MS, now.getTime()));

  const byPaymentIntent = new Map<string, StripeSettlement>();
  const byRefund = new Map<string, StripeSettlement>();
  for await (const payout of stripe.payouts.list({ created: { gte: unix(range.from), lte: unix(until) }, limit: 100 })) {
    if (SKIPPED_STATUSES.has(payout.status)) continue;
    for await (const transaction of stripe.balanceTransactions.list({ payout: payout.id, limit: 100, expand: ["data.source"] })) {
      const source = transaction.source;
      if (!source || typeof source === "string") continue;
      const settlement = { payoutId: payout.id, payoutDate: arrivalDate(payout), feeNok: roundNok(transaction.fee / 100) };
      if (source.object === "charge" && source.payment_intent) {
        byPaymentIntent.set(typeof source.payment_intent === "string" ? source.payment_intent : source.payment_intent.id, settlement);
      } else if (source.object === "refund") {
        byRefund.set(source.id, settlement);
      }
    }
  }

  const payoutsInMonth = [];
  for await (const payout of stripe.payouts.list({ arrival_date: { gte: unix(range.from), lt: unix(range.to) }, limit: 100 })) {
    payoutsInMonth.push({ id: payout.id, arrivalDate: arrivalDate(payout), amountNok: roundNok(payout.amount / 100), status: payout.status });
  }

  return { byPaymentIntent, byRefund, payoutsInMonth };
}
