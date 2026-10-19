import { describe, expect, it, vi } from "vitest";
import { planOrderRefund, refundOrderPayments, sumRefundableCents } from "./orderRefunds";

const payment = (
  id: string,
  amountChargedCents: number,
  createdAt: string,
  refunds: number[] = [],
  stripePaymentIntentId: string | null = `pi_${id}`,
) => ({
  id,
  stripePaymentIntentId,
  amountChargedCents,
  createdAt: new Date(createdAt),
  refunds: refunds.map((amountRefundedCents) => ({ amountRefundedCents })),
});

describe("sumRefundableCents", () => {
  it("is everything charged minus everything already refunded", () => {
    expect(
      sumRefundableCents([payment("a", 100_00, "2026-10-01", [20_00]), payment("b", 50_00, "2026-10-02", [5_00, 5_00])]),
    ).toBe(120_00);
  });

  it("is 0 with no payments", () => {
    expect(sumRefundableCents([])).toBe(0);
  });
});

describe("planOrderRefund", () => {
  it("refunds everything left on every payment for ALL", () => {
    const plan = planOrderRefund([payment("a", 100_00, "2026-10-01", [20_00]), payment("b", 50_00, "2026-10-02")], "ALL");
    expect(plan).toEqual({
      ok: true,
      totalCents: 130_00,
      allocations: [
        { paymentId: "b", paymentIntentId: "pi_b", amountCents: 50_00, alreadyRefundedCents: 0 },
        { paymentId: "a", paymentIntentId: "pi_a", amountCents: 80_00, alreadyRefundedCents: 20_00 },
      ],
    });
  });

  it("takes a partial amount from the newest payment first, spilling into older ones", () => {
    const plan = planOrderRefund([payment("a", 100_00, "2026-10-01"), payment("b", 30_00, "2026-10-02")], 50_00);
    expect(plan).toEqual({
      ok: true,
      totalCents: 50_00,
      allocations: [
        { paymentId: "b", paymentIntentId: "pi_b", amountCents: 30_00, alreadyRefundedCents: 0 },
        { paymentId: "a", paymentIntentId: "pi_a", amountCents: 20_00, alreadyRefundedCents: 0 },
      ],
    });
  });

  it("skips payments that are already fully refunded", () => {
    const plan = planOrderRefund([payment("a", 100_00, "2026-10-01"), payment("b", 30_00, "2026-10-02", [30_00])], 10_00);
    expect(plan).toMatchObject({ ok: true, allocations: [{ paymentId: "a", amountCents: 10_00 }] });
  });

  it("refuses more than is left to refund", () => {
    expect(planOrderRefund([payment("a", 100_00, "2026-10-01", [90_00])], 20_00)).toEqual({
      ok: false,
      reason: "EXCEEDS_REFUNDABLE",
    });
  });

  it("has nothing to refund when nothing was paid (or it is all refunded)", () => {
    expect(planOrderRefund([], "ALL")).toEqual({ ok: false, reason: "NOTHING_TO_REFUND" });
    expect(planOrderRefund([payment("a", 100_00, "2026-10-01", [100_00])], "ALL")).toEqual({
      ok: false,
      reason: "NOTHING_TO_REFUND",
    });
  });

  it("refuses a zero, negative or fractional amount", () => {
    const payments = [payment("a", 100_00, "2026-10-01")];
    expect(planOrderRefund(payments, 0)).toEqual({ ok: false, reason: "INVALID_AMOUNT" });
    expect(planOrderRefund(payments, -5)).toEqual({ ok: false, reason: "INVALID_AMOUNT" });
    expect(planOrderRefund(payments, 1.5)).toEqual({ ok: false, reason: "INVALID_AMOUNT" });
  });

  it("refuses when a payment it would refund has no Stripe payment intent", () => {
    expect(planOrderRefund([payment("a", 100_00, "2026-10-01", [], null)], "ALL")).toEqual({
      ok: false,
      reason: "MISSING_PAYMENT_INTENT",
    });
  });
});

describe("refundOrderPayments", () => {
  function setup(payments: ReturnType<typeof payment>[]) {
    const created: unknown[] = [];
    const client = {
      orderPayment: { findMany: vi.fn().mockResolvedValue(payments) },
      orderRefund: {
        create: vi.fn(async ({ data }: { data: unknown }) => {
          created.push(data);
          return data;
        }),
      },
    };
    let n = 0;
    const stripe = { refunds: { create: vi.fn(async () => ({ id: `re_${++n}` })) } };
    return { client, stripe, created };
  }

  it("issues one Stripe refund per allocation and records each in the ledger", async () => {
    const { client, stripe, created } = setup([payment("a", 100_00, "2026-10-01"), payment("b", 30_00, "2026-10-02")]);

    const result = await refundOrderPayments(client, stripe, {
      orderId: "o1",
      companyId: "c1",
      amountCents: "ALL",
      reason: "Outside our area",
    });

    expect(result).toEqual({ ok: true, refundedCents: 130_00 });
    expect(stripe.refunds.create).toHaveBeenNthCalledWith(
      1,
      { payment_intent: "pi_b", amount: 30_00, metadata: { orderId: "o1", orderPaymentId: "b" } },
      { idempotencyKey: "order-refund:b:0:3000" },
    );
    expect(stripe.refunds.create).toHaveBeenNthCalledWith(
      2,
      { payment_intent: "pi_a", amount: 100_00, metadata: { orderId: "o1", orderPaymentId: "a" } },
      { idempotencyKey: "order-refund:a:0:10000" },
    );
    expect(created).toEqual([
      { orderId: "o1", companyId: "c1", orderPaymentId: "b", stripeRefundId: "re_1", amountRefundedCents: 30_00, reason: "Outside our area" },
      { orderId: "o1", companyId: "c1", orderPaymentId: "a", stripeRefundId: "re_2", amountRefundedCents: 100_00, reason: "Outside our area" },
    ]);
  });

  it("returns the plan's reason without calling Stripe when nothing can be refunded", async () => {
    const { client, stripe } = setup([]);
    const result = await refundOrderPayments(client, stripe, { orderId: "o1", companyId: "c1", amountCents: "ALL" });
    expect(result).toEqual({ ok: false, reason: "NOTHING_TO_REFUND" });
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("reports what was refunded before a Stripe failure, so a retry only refunds the rest", async () => {
    const { client, stripe, created } = setup([payment("a", 100_00, "2026-10-01"), payment("b", 30_00, "2026-10-02")]);
    stripe.refunds.create.mockResolvedValueOnce({ id: "re_1" }).mockRejectedValueOnce(new Error("card_declined"));

    const result = await refundOrderPayments(client, stripe, { orderId: "o1", companyId: "c1", amountCents: "ALL" });

    expect(result).toEqual({ ok: false, reason: "STRIPE_ERROR", refundedCents: 30_00 });
    expect(created).toHaveLength(1);
  });
});
