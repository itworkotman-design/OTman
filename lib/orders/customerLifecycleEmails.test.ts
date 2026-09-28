import { beforeEach, describe, expect, it } from "vitest";
import { buildBalanceDueEmail, buildOrderConfirmedEmail, buildOrderReceivedEmail } from "./customerLifecycleEmails";

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

describe("order reference shown to the customer", () => {
  const withNumber = { ...order, orderNumber: "K7MQ4XZ2" };

  it("uses the public order number, never the internal displayId, when the order has one", () => {
    for (const build of [buildOrderReceivedEmail, buildOrderConfirmedEmail, buildBalanceDueEmail]) {
      const { subject, html } = build(withNumber);

      expect(subject).toContain("K7MQ4XZ2");
      expect(html).toContain("K7MQ4XZ2");
      expect(subject).not.toContain("#42");
      expect(html).not.toContain("#42");
    }
  });

  it("falls back to the displayId for older orders that have no public number", () => {
    expect(buildOrderReceivedEmail({ ...order, orderNumber: null }).subject).toContain("#42");
    expect(buildOrderReceivedEmail(order).subject).toContain("#42");
  });
});

describe("buildOrderReceivedEmail", () => {
  it("references the order number and greets the customer by name", () => {
    const { subject, html } = buildOrderReceivedEmail(order);

    expect(subject).toContain("#42");
    expect(html).toContain("Ola Nordmann");
    expect(html).toContain("#42");
  });

  it("works for an order with no actionToken — none exists until staff approve/reject", () => {
    expect(() => buildOrderReceivedEmail({ ...order, actionToken: null })).not.toThrow();
  });

  it("contains no payment/cancel/change links — those pages reject orders that are still 'processing'", () => {
    const { html } = buildOrderReceivedEmail(order);

    expect(html).not.toContain("/betaling/");
    expect(html).not.toContain("/bestilling/");
  });

  it("tells the customer they can reply to the email (replies thread into the order's Email Center)", () => {
    const { html } = buildOrderReceivedEmail(order);

    expect(html).toContain("svar på denne e-posten");
  });
});
