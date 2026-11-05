import { describe, expect, it } from "vitest";
import { buildWebSalesReport, parseReportMonth, type StripeSettlementLookup } from "./webSalesReport";

describe("parseReportMonth — the month in Oslo time", () => {
  it("runs from Oslo midnight on the 1st to Oslo midnight on the 1st of the next month", () => {
    expect(parseReportMonth("2026-11")).toEqual({
      month: "2026-11",
      from: new Date("2026-10-31T23:00:00Z"),
      to: new Date("2026-11-30T23:00:00Z"),
    });
    // Summer time.
    expect(parseReportMonth("2026-07")?.from).toEqual(new Date("2026-06-30T22:00:00Z"));
    expect(parseReportMonth("2026-12")?.to).toEqual(new Date("2026-12-31T23:00:00Z"));
  });

  it("rejects anything else", () => {
    expect(parseReportMonth("2026-13")).toBeNull();
    expect(parseReportMonth("2026-1")).toBeNull();
    expect(parseReportMonth(null)).toBeNull();
  });
});

const payment = (over: Record<string, unknown> = {}) => ({
  id: "pay1",
  receiptNumber: 7,
  createdAt: new Date("2026-11-04T09:30:00Z"),
  amountChargedCents: 373000,
  stripePaymentIntentId: "pi_1",
  orderNumber: "20049",
  customerName: "Kari Nordmann",
  ...over,
});
const refund = (over: Record<string, unknown> = {}) => ({
  id: "ref1",
  receiptNumber: 9,
  createdAt: new Date("2026-11-06T12:00:00Z"),
  amountRefundedCents: 50000,
  stripeRefundId: "re_1",
  creditsReceiptNumber: 7,
  orderNumber: "20049",
  customerName: "Kari Nordmann",
  ...over,
});
const emptyStripe: StripeSettlementLookup = { byPaymentIntent: new Map(), byRefund: new Map(), payoutsInMonth: [] };

describe("buildWebSalesReport — every receipt and credit note of the month", () => {
  it("lists receipts as sales and credit notes as negative, with the VAT split as on the documents", () => {
    const report = buildWebSalesReport({ month: "2026-11", payments: [payment()], refunds: [refund()], stripe: emptyStripe });

    expect(report.rows).toEqual([
      expect.objectContaining({ type: "Kvittering", number: "W-7", date: "2026-11-04", orderNumber: "20049", customer: "Kari Nordmann", incVatNok: 3730, exVatNok: 2984, vatNok: 746, stripeRef: "pi_1", credits: null }),
      expect.objectContaining({ type: "Kreditnota", number: "W-9", date: "2026-11-06", incVatNok: -500, exVatNok: -400, vatNok: -100, stripeRef: "re_1", credits: "W-7" }),
    ]);
  });

  it("orders the rows by number, and flags a payment that never got a number", () => {
    const report = buildWebSalesReport({
      month: "2026-11",
      payments: [payment({ id: "p2", receiptNumber: 8 }), payment({ id: "p3", receiptNumber: null }), payment()],
      refunds: [],
      stripe: emptyStripe,
    });
    expect(report.rows.map((row) => row.number)).toEqual(["W-7", "W-8", "Mangler nummer"]);
  });

  it("shows which Stripe payout each one went out in, and Stripe's fee", () => {
    const stripe: StripeSettlementLookup = {
      byPaymentIntent: new Map([["pi_1", { payoutId: "po_1", payoutDate: "2026-11-09", feeNok: 63.6 }]]),
      byRefund: new Map([["re_1", { payoutId: "po_2", payoutDate: "2026-11-11", feeNok: 0 }]]),
      payoutsInMonth: [],
    };
    const report = buildWebSalesReport({ month: "2026-11", payments: [payment()], refunds: [refund()], stripe });
    expect(report.rows[0]).toMatchObject({ payoutId: "po_1", payoutDate: "2026-11-09", feeNok: 63.6 });
    expect(report.rows[1]).toMatchObject({ payoutId: "po_2", payoutDate: "2026-11-11" });
  });

  it("adds it all up: sales, refunds, net, fees, and what Stripe hasn't paid out yet", () => {
    const stripe: StripeSettlementLookup = {
      byPaymentIntent: new Map([["pi_1", { payoutId: "po_1", payoutDate: "2026-11-09", feeNok: 63.6 }]]),
      byRefund: new Map(),
      payoutsInMonth: [{ id: "po_1", arrivalDate: "2026-11-09", amountNok: 3166.4, status: "paid" }],
    };
    const report = buildWebSalesReport({
      month: "2026-11",
      payments: [payment(), payment({ id: "p2", receiptNumber: 8, amountChargedCents: 125000, stripePaymentIntentId: "pi_2" })],
      refunds: [refund()],
      stripe,
    });

    expect(report.totals).toEqual({
      sales: { incVatNok: 4980, exVatNok: 3984, vatNok: 996 },
      refunds: { incVatNok: -500, exVatNok: -400, vatNok: -100 },
      net: { incVatNok: 4480, exVatNok: 3584, vatNok: 896 },
      feesNok: 63.6,
      notPaidOutNok: 750,
      payoutsNok: 3166.4,
    });
    expect(report.notPaidOut.map((row) => row.number)).toEqual(["W-8", "W-9"]);
    expect(report.payouts).toEqual(stripe.payoutsInMonth);
  });
});
