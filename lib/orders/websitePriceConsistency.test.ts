import { describe, expect, it, vi } from "vitest";

// stripePaymentOverview (imported for nextStripePaymentStatus) loads the DB client.
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { checkWebsiteOrderPricing, type PricingCheckInput } from "./websitePriceConsistency";
import { formatKr } from "./orderChangeText";

const snapshot = (total: number, prices: number[]) => ({
  version: 1 as const,
  totalIncVatNok: total,
  lines: prices.map((price, i) => ({ key: `g::${i}`, group: "g", label: String(i), qty: 1, price })),
  details: [],
});

const base = (over: Partial<PricingCheckInput> = {}): PricingCheckInput => ({
  current: snapshot(5110, [760, 1940, 330, 1000, 1080]),
  shownTotalIncVat: 5110,
  payments: [{ amountChargedCents: 511000, createdAt: new Date("2026-11-03T14:00:00Z"), orderSnapshot: null, refunds: [] }],
  paymentStatus: "paid",
  closed: false,
  stripe: true,
  ...over,
});

describe("checkWebsiteOrderPricing — does every place agree on what the customer pays?", () => {
  it("finds nothing wrong when the lines, the booking charge and the badge all match", () => {
    expect(checkWebsiteOrderPricing(base())).toEqual([]);
  });

  it("flags lines that don't add up to the total charged (the Stripe description and pay page would disagree)", () => {
    expect(checkWebsiteOrderPricing(base({ current: snapshot(5110, [760, 1940, 330, 1000, 1070]) }))).toEqual([
      { code: "LINES_DONT_ADD_UP", detail: `lines ${formatKr(5100)} vs total ${formatKr(5110)}` },
    ]);
  });

  it("allows less than 1 kr of rounding between the lines and the total", () => {
    // (Badge left out: 0,50 kr would count as owed.)
    expect(checkWebsiteOrderPricing(base({ current: snapshot(5110.5, [760, 1940, 330, 1000, 1080]), stripe: false }))).toEqual([]);
  });

  it("flags a booking charged differently than the total the customer was shown", () => {
    expect(checkWebsiteOrderPricing(base({ shownTotalIncVat: 5000 }))).toContainEqual({
      code: "CHARGED_DIFFERS_FROM_SHOWN",
      detail: `shown ${formatKr(5000)}, charged ${formatKr(5110)} at booking`,
    });
  });

  it("compares the shown total with the first payment only (later ones are top-ups)", () => {
    const payments = [
      { amountChargedCents: 378000, createdAt: new Date("2026-11-03T14:00:00Z"), orderSnapshot: null, refunds: [] },
      { amountChargedCents: 133000, createdAt: new Date("2026-11-03T15:00:00Z"), orderSnapshot: null, refunds: [] },
    ];
    expect(checkWebsiteOrderPricing(base({ shownTotalIncVat: 3780, payments }))).toEqual([]);
  });

  it("flags a payment badge that disagrees with what was paid (Stripe)", () => {
    expect(checkWebsiteOrderPricing(base({ paymentStatus: "pending" }))).toEqual([
      { code: "PAYMENT_STATUS_STALE", detail: "badge pending, should be paid" },
    ]);
  });

  it("doesn't judge the badge with fakturas, before any payment, or on a cancelled order", () => {
    expect(checkWebsiteOrderPricing(base({ paymentStatus: "pending", stripe: false }))).toEqual([]);
    expect(checkWebsiteOrderPricing(base({ paymentStatus: "pending", payments: [], shownTotalIncVat: null }))).toEqual([]);
    expect(checkWebsiteOrderPricing(base({ paymentStatus: "paid", closed: true }))).toEqual([]);
  });
});
