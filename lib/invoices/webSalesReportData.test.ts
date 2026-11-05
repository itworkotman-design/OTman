import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  paymentFindMany: vi.fn(),
  refundFindMany: vi.fn(),
  fetchStripeSettlements: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { orderPayment: { findMany: mocks.paymentFindMany }, orderRefund: { findMany: mocks.refundFindMany } },
}));
vi.mock("@/lib/stripe/stripeClient", () => ({ getStripeClient: () => ({}) }));
vi.mock("@/lib/stripe/payoutLookup", () => ({ fetchStripeSettlements: mocks.fetchStripeSettlements }));

import { loadWebSalesReport } from "./webSalesReportData";
import { parseReportMonth } from "./webSalesReport";

const month = parseReportMonth("2026-11")!;
const order = { displayId: 20049, orderNumber: null, customerName: null, customerLabel: "Kari Nordmann" };

describe("loadWebSalesReport — the company's Stripe payments and refunds of the month", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.paymentFindMany.mockResolvedValue([
      { id: "p1", receiptNumber: 7, createdAt: new Date("2026-11-04T09:30:00Z"), amountChargedCents: 373000, stripePaymentIntentId: "pi_1", order },
    ]);
    mocks.refundFindMany.mockResolvedValue([
      {
        id: "r1",
        receiptNumber: 8,
        createdAt: new Date("2026-11-06T12:00:00Z"),
        amountRefundedCents: 50000,
        stripeRefundId: "re_1",
        orderPayment: { receiptNumber: 7 },
        order,
      },
    ]);
    mocks.fetchStripeSettlements.mockResolvedValue({ byPaymentIntent: new Map(), byRefund: new Map(), payoutsInMonth: [] });
  });

  it("reads only this company's documents dated in the month", async () => {
    await loadWebSalesReport({ companyId: "c1", month });
    const where = { companyId: "c1", createdAt: { gte: month.from, lt: month.to } };
    expect(mocks.paymentFindMany.mock.calls[0]![0].where).toEqual(where);
    expect(mocks.refundFindMany.mock.calls[0]![0].where).toEqual(where);
    expect(mocks.fetchStripeSettlements).toHaveBeenCalledWith(expect.anything(), { from: month.from, to: month.to });
  });

  it("builds the report rows (order number falls back to the display id, customer to the label)", async () => {
    const { report, stripeUnavailable } = await loadWebSalesReport({ companyId: "c1", month });
    expect(stripeUnavailable).toBe(false);
    expect(report.rows.map((row) => [row.number, row.orderNumber, row.customer, row.credits])).toEqual([
      ["W-7", "20049", "Kari Nordmann", null],
      ["W-8", "20049", "Kari Nordmann", "W-7"],
    ]);
  });

  it("still makes the report when Stripe can't be reached, and says so", async () => {
    mocks.fetchStripeSettlements.mockRejectedValue(new Error("stripe down"));
    const { report, stripeUnavailable } = await loadWebSalesReport({ companyId: "c1", month });
    expect(stripeUnavailable).toBe(true);
    expect(report.rows).toHaveLength(2);
  });
});
