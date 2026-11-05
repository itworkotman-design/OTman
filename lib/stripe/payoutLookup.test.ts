import { describe, expect, it, vi } from "vitest";
import { fetchStripeSettlements } from "./payoutLookup";

const iterate = <T,>(items: T[]) => ({
  async *[Symbol.asyncIterator]() {
    for (const item of items) yield item;
  },
});
const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

function fakeStripe() {
  const payoutsList = vi.fn((params: { created?: unknown; arrival_date?: unknown }) =>
    params.arrival_date
      ? iterate([{ id: "po_1", arrival_date: unix("2026-11-09T00:00:00Z"), amount: 316640, status: "paid" }])
      : iterate([
          { id: "po_1", arrival_date: unix("2026-11-09T00:00:00Z"), amount: 316640, status: "paid" },
          { id: "po_2", arrival_date: unix("2026-11-12T00:00:00Z"), amount: -50000, status: "paid" },
          { id: "po_x", arrival_date: unix("2026-11-13T00:00:00Z"), amount: 100, status: "failed" },
        ]),
  );
  const balanceList = vi.fn((params: { payout: string }) =>
    params.payout === "po_1"
      ? iterate([
          { type: "charge", fee: 6360, source: { id: "ch_1", object: "charge", payment_intent: "pi_1" } },
          { type: "payout", fee: 0, source: { id: "po_1", object: "payout" } },
        ])
      : iterate([{ type: "refund", fee: 0, source: { id: "re_1", object: "refund" } }]),
  );
  return { payouts: { list: payoutsList }, balanceTransactions: { list: balanceList } };
}

describe("fetchStripeSettlements — which payout each payment and refund went out in", () => {
  const range = { from: new Date("2026-10-31T23:00:00Z"), to: new Date("2026-11-30T23:00:00Z"), now: new Date("2026-12-02T10:00:00Z") };

  it("maps charges (by payment intent) and refunds to their payout, with Stripe's fee", async () => {
    const lookup = await fetchStripeSettlements(fakeStripe(), range);

    expect(lookup.byPaymentIntent.get("pi_1")).toEqual({ payoutId: "po_1", payoutDate: "2026-11-09", feeNok: 63.6 });
    expect(lookup.byRefund.get("re_1")).toEqual({ payoutId: "po_2", payoutDate: "2026-11-12", feeNok: 0 });
  });

  it("lists the payouts that reached the bank in the month", async () => {
    const lookup = await fetchStripeSettlements(fakeStripe(), range);
    expect(lookup.payoutsInMonth).toEqual([{ id: "po_1", arrivalDate: "2026-11-09", amountNok: 3166.4, status: "paid" }]);
  });

  it("looks at payouts made from the month's start until a few weeks after it (never in the future), skipping failed ones", async () => {
    const stripe = fakeStripe();
    await fetchStripeSettlements(stripe, range);

    expect(stripe.payouts.list).toHaveBeenCalledWith({ created: { gte: unix("2026-10-31T23:00:00Z"), lte: unix("2026-12-02T10:00:00Z") }, limit: 100 });
    expect(stripe.payouts.list).toHaveBeenCalledWith({ arrival_date: { gte: unix("2026-10-31T23:00:00Z"), lt: unix("2026-11-30T23:00:00Z") }, limit: 100 });
    expect(stripe.balanceTransactions.list.mock.calls.map((call) => call[0].payout)).toEqual(["po_1", "po_2"]);
    expect(stripe.balanceTransactions.list).toHaveBeenCalledWith({ payout: "po_1", limit: 100, expand: ["data.source"] });
  });
});
