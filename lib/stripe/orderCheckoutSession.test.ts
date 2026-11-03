import { describe, expect, it, vi } from "vitest";
import { BOOKING_CHECKOUT_MINUTES, createOrderCheckoutSession } from "./orderCheckoutSession";

function fakeStripe() {
  const create = vi.fn().mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" });
  return { create, stripe: { checkout: { sessions: { create } } } };
}

const order = {
  id: "order1",
  email: "customer@example.com",
  orderNumber: "K7MQ4XZ2",
  displayId: 42,
  productsSummary: "Vaskemaskin",
};

describe("createOrderCheckoutSession", () => {
  it("charges the amount in øre, labelled with the public order number, and returns to the payment page", async () => {
    const { create, stripe } = fakeStripe();

    await createOrderCheckoutSession(stripe, {
      order,
      token: "t".repeat(32),
      amountIncVatNok: 1250.5,
      chargeKind: "initial",
      baseUrl: "https://otman.no",
    });

    const args = create.mock.calls[0]![0];
    expect(args.customer_email).toBe("customer@example.com");
    expect(args.line_items[0].price_data).toMatchObject({
      currency: "nok",
      unit_amount: 125050,
      product_data: { name: "Otman bestilling #K7MQ4XZ2", description: "Vaskemaskin" },
    });
    expect(args.success_url).toBe(`https://otman.no/betaling/${"t".repeat(32)}?result=success`);
    expect(args.cancel_url).toBe(`https://otman.no/betaling/${"t".repeat(32)}?result=cancelled`);
    expect(args.metadata).toEqual({ orderId: "order1", actionToken: "t".repeat(32), chargeKind: "initial" });
    // Only a booking session is short-lived.
    expect(args.expires_at).toBeUndefined();
  });

  it("labels a top-up as an additional payment", async () => {
    const { create, stripe } = fakeStripe();
    await createOrderCheckoutSession(stripe, {
      order,
      token: "t".repeat(32),
      amountIncVatNok: 100,
      chargeKind: "topup",
      baseUrl: "https://otman.no",
    });
    expect(create.mock.calls[0]![0].line_items[0].price_data.product_data.name).toBe(
      "Otman bestilling #K7MQ4XZ2 — tilleggsbetaling",
    );
  });

  it("makes a booking session expire after BOOKING_CHECKOUT_MINUTES, so an unpaid order is cancelled quickly", async () => {
    const { create, stripe } = fakeStripe();
    const now = new Date("2026-11-03T12:00:00Z");

    await createOrderCheckoutSession(stripe, {
      order,
      token: "t".repeat(32),
      amountIncVatNok: 100,
      chargeKind: "booking",
      baseUrl: "https://otman.no",
      now,
    });

    const args = create.mock.calls[0]![0];
    expect(args.expires_at).toBe(Math.floor(now.getTime() / 1000) + BOOKING_CHECKOUT_MINUTES * 60);
    expect(args.metadata.chargeKind).toBe("booking");
    // Stripe refuses an expiry under 30 minutes.
    expect(BOOKING_CHECKOUT_MINUTES).toBeGreaterThanOrEqual(30);
  });
});
