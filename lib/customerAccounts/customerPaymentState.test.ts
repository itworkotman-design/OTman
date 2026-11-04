import { describe, expect, it } from "vitest";
import { customerPaymentState } from "./customerPaymentState";

const order = (over: Partial<Parameters<typeof customerPaymentState>[0]> = {}) => ({
  status: "processing",
  paymentStatus: "paid" as string | null,
  actionToken: "tok",
  ...over,
});

describe("customerPaymentState — the payment badge on My order", () => {
  it("is paid once the order is paid", () => {
    expect(customerPaymentState(order(), { stripe: true })).toEqual({ kind: "paid", payPath: null });
  });

  it("is waiting for payment, with the pay page link while payments go through Stripe", () => {
    expect(customerPaymentState(order({ paymentStatus: "pending" }), { stripe: true })).toEqual({ kind: "due", payPath: "/betaling/tok" });
  });

  it("has no pay link with manual payments (a faktura is paid by bank transfer) or without a token", () => {
    expect(customerPaymentState(order({ paymentStatus: "pending" }), { stripe: false })).toEqual({ kind: "due", payPath: null });
    expect(customerPaymentState(order({ paymentStatus: "pending", actionToken: null }), { stripe: true })).toEqual({ kind: "due", payPath: null });
  });

  it("tells the customer a refund is on its way when they paid more than the order costs now", () => {
    expect(customerPaymentState(order({ paymentStatus: "refund_pending" }), { stripe: true })).toEqual({ kind: "refund", payPath: null });
  });

  it("says nothing about payment on an order without a payment status, or one that's cancelled or refunded", () => {
    expect(customerPaymentState(order({ paymentStatus: null }), { stripe: true })).toBeNull();
    expect(customerPaymentState(order({ status: "cancelled", paymentStatus: "pending" }), { stripe: true })).toBeNull();
    expect(customerPaymentState(order({ status: "refunded" }), { stripe: true })).toBeNull();
  });
});
