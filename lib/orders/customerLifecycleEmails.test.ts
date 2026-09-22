import { beforeEach, describe, expect, it } from "vitest";
import { buildBalanceDueEmail, buildOrderConfirmedEmail } from "./customerLifecycleEmails";

beforeEach(() => {
  process.env.ORDER_ACTION_BASE_URL = "https://otman.no";
});

const order = {
  id: "order1",
  displayId: 42,
  customerName: "Ola Nordmann",
  customerLabel: null,
  statusNotes: null,
  actionToken: "a".repeat(32),
};

describe("buildBalanceDueEmail", () => {
  it("references the order number and links to the payment page", () => {
    const { subject, html } = buildBalanceDueEmail(order);

    expect(subject).toContain("#42");
    expect(html).toContain(`/betaling/${order.actionToken}`);
    expect(html).toContain("Ola Nordmann");
  });

  it("throws for an order with no actionToken", () => {
    expect(() => buildBalanceDueEmail({ ...order, actionToken: null })).toThrow();
  });
});

describe("buildOrderConfirmedEmail", () => {
  it("references the order number and links to the request-change page, not a payment link", () => {
    const { subject, html } = buildOrderConfirmedEmail(order);

    expect(subject).toContain("#42");
    expect(html).toContain(`/bestilling/endre/${order.actionToken}`);
    expect(html).not.toContain(`/betaling/${order.actionToken}`);
  });

  it("throws for an order with no actionToken", () => {
    expect(() => buildOrderConfirmedEmail({ ...order, actionToken: null })).toThrow();
  });
});
