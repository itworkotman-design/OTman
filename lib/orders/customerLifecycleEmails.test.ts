import { beforeEach, describe, expect, it } from "vitest";
import {
  buildBalanceDueEmail,
  buildOrderConfirmedEmail,
  buildOrderReceivedEmail,
  buildOrderUpdatedEmail,
} from "./customerLifecycleEmails";

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

  it("states what was paid, the new total, exactly what to pay now and what changed", () => {
    const { html } = buildBalanceDueEmail({
      ...order,
      balanceDue: {
        paidIncVatNok: 1099,
        totalIncVatNok: 1749,
        amountDueIncVatNok: 650,
        changes: ["Lagt til: Tørketrommel (+550 kr)", "Leveringsadresse: Kirkegata 5 → <Storgata 1>"],
      },
    });

    expect(html).toContain("1 099 kr");
    expect(html).toContain("1 749 kr");
    expect(html).toContain("650 kr");
    expect(html).toContain("Lagt til: Tørketrommel (+550 kr)");
    // Change text is escaped.
    expect(html).toContain("&lt;Storgata 1&gt;");
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

  it("has no login block when the order has no customer account", () => {
    const { html } = buildOrderReceivedEmail({ ...order, orderNumber: "K7MQ4XZ2" });

    expect(html).not.toContain("/min-bestilling");
  });

  it("links to My order and gives the username, saying the password comes separately", () => {
    const { html } = buildOrderReceivedEmail({
      ...order,
      orderNumber: "K7MQ4XZ2",
      customerLogin: { email: "ola@example.com", hasNewPassword: true },
    });

    expect(html).toContain("https://otman.no/min-bestilling/K7MQ4XZ2");
    expect(html).toContain("ola@example.com");
    expect(html).toContain("egen e-post");
  });

  it("tells a returning customer to use their existing password, with a forgot-password link", () => {
    const { html } = buildOrderReceivedEmail({
      ...order,
      orderNumber: "K7MQ4XZ2",
      customerLogin: { email: "ola@example.com", hasNewPassword: false },
    });

    expect(html).toContain("passordet du allerede har");
    expect(html).toContain("https://otman.no/min-bestilling/logg-inn?glemt=1");
    expect(html).not.toContain("egen e-post");
  });
});

describe("buildOrderUpdatedEmail", () => {
  it("lists the changes and the new total, with a link back to the order", () => {
    const { subject, html } = buildOrderUpdatedEmail({
      ...order,
      orderNumber: "K7MQ4XZ2",
      actionToken: null,
      orderUpdate: { changes: ["Lagt til: Utpakking", "Telefon: <1> → 2"], totalIncVatNok: 1749 },
    });

    expect(subject).toContain("#K7MQ4XZ2");
    expect(html).toContain("Lagt til: Utpakking");
    expect(html).toContain("Telefon: &lt;1&gt; → 2");
    expect(html).toContain("1");
    expect(html).toContain("749");
    expect(html).toContain("https://otman.no/min-bestilling/K7MQ4XZ2");
  });

  it("leaves out the total when the order has no price", () => {
    const { html } = buildOrderUpdatedEmail({
      ...order,
      orderNumber: "K7MQ4XZ2",
      orderUpdate: { changes: ["Notat endret"], totalIncVatNok: null },
    });

    expect(html).not.toContain("Ny totalpris");
  });
});
