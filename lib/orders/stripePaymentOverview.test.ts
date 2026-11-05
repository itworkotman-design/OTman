import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { buildStripePaymentOverview, nextStripePaymentStatus } from "./stripePaymentOverview";
import type { OrderStateSnapshot } from "./paidOrderSnapshot";

const current = { version: 1, totalIncVatNok: 5110, lines: [], details: [] } as unknown as OrderStateSnapshot;

const booking = {
  id: "p1",
  amountChargedCents: 450000,
  stripePaymentIntentId: "pi_1",
  createdAt: new Date("2026-11-03T14:30:00Z"),
  orderSnapshot: null,
  refunds: [],
};
const change = {
  id: "p2",
  amountChargedCents: 61000,
  stripePaymentIntentId: "pi_2",
  createdAt: new Date("2026-11-03T15:00:00Z"),
  orderSnapshot: null,
  refunds: [],
};

describe("buildStripePaymentOverview", () => {
  it("lists every Stripe payment newest first — the first one is the booking payment, later ones additional — and how the order stands", () => {
    const overview = buildStripePaymentOverview([booking, change], current);

    expect(overview.payments.map((p) => [p.id, p.kind, p.amountCents])).toEqual([
      ["p2", "additional", 61000],
      ["p1", "booking", 450000],
    ]);
    expect(overview.payments[1]).toMatchObject({ stripePaymentIntentId: "pi_1", createdAt: "2026-11-03T14:30:00.000Z" });
    expect(overview.comparison).toEqual({
      outcome: "settled",
      totalPaidIncVatNok: 5110,
      totalRefundedIncVatNok: 0,
      currentTotalIncVatNok: 5110,
      differenceIncVatNok: 0,
    });
  });

  it("shows each payment's receipt (W-number, and when it was emailed) — none before one was made", () => {
    const overview = buildStripePaymentOverview(
      [{ ...booking, receiptNumber: 7, receiptSentAt: new Date("2026-11-03T14:31:00Z") }, { ...change, receiptNumber: 8, receiptSentAt: null }, { ...change, id: "p3" }],
      current,
    );
    expect(overview.payments.map((p) => p.receipt)).toEqual([null, { number: "W-8", sentAt: null }, { number: "W-7", sentAt: "2026-11-03T14:31:00.000Z" }]);
  });

  it("shows refunds under their payment and nets them out of what's paid", () => {
    const refunded = {
      ...change,
      refunds: [
        { id: "r1", amountRefundedCents: 20000, reason: "Removed an item", createdAt: new Date("2026-11-03T16:00:00Z"), orderSnapshot: null, receiptNumber: 9, receiptSentAt: null },
      ],
    };

    const overview = buildStripePaymentOverview([booking, refunded], current);

    // Each refund with its credit note (kreditnota).
    expect(overview.payments[0]!.refunds).toEqual([
      { id: "r1", amountCents: 20000, reason: "Removed an item", createdAt: "2026-11-03T16:00:00.000Z", creditNote: { number: "W-9", sentAt: null } },
    ]);
    expect(overview.comparison).toMatchObject({ totalPaidIncVatNok: 4910, differenceIncVatNok: 200, outcome: "due" });
  });

  it("a declined order whose payments all went back is closed — nothing due, and how much was refunded", () => {
    const refundAll = (payment: typeof booking) => ({
      ...payment,
      refunds: [{ id: `r-${payment.id}`, amountRefundedCents: payment.amountChargedCents, reason: "Declined", createdAt: new Date("2026-11-04T10:00:00Z"), orderSnapshot: null }],
    });

    const overview = buildStripePaymentOverview([refundAll(booking), refundAll(change)], current, true);

    expect(overview.comparison).toEqual({
      outcome: "closed",
      totalPaidIncVatNok: 0,
      totalRefundedIncVatNok: 5110,
      currentTotalIncVatNok: 0,
      differenceIncVatNok: 0,
    });
  });

  it("an order with no Stripe payment yet is unpaid", () => {
    expect(buildStripePaymentOverview([], current).comparison).toMatchObject({ outcome: "unpaid", totalPaidIncVatNok: 0 });
  });
});

describe("nextStripePaymentStatus — the order's payment status from its Stripe payments", () => {
  it("is pending while more is due than was paid", () => {
    expect(nextStripePaymentStatus("due")).toBe("pending");
  });

  it("is paid once covered", () => {
    expect(nextStripePaymentStatus("settled")).toBe("paid");
  });

  it("is refund pending when the order got cheaper than what was paid", () => {
    expect(nextStripePaymentStatus("refund")).toBe("refund_pending");
  });

  it("has no say over an order nothing was paid on yet (a booking still in checkout keeps its own status)", () => {
    expect(nextStripePaymentStatus("unpaid")).toBeNull();
  });
});

describe("nextStripePaymentStatus — a cancelled or declined order", () => {
  it("leaves the payment status alone (the order status says it)", () => {
    expect(nextStripePaymentStatus("closed")).toBeNull();
  });
});
