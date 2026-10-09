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

    expect(html).toContain("Har du spørsmål eller er du usikker på hvordan du endrer noe? Svar på denne e-posten, så tar vi kontakt med deg så snart som mulig.");
  });

  it("has no login block when the order has no customer account", () => {
    const { html } = buildOrderReceivedEmail({ ...order, orderNumber: "K7MQ4XZ2" });

    expect(html).not.toContain("/min-bestilling");
  });

  it("gives the username and the password in the same email, with a link to My order", () => {
    const { html } = buildOrderReceivedEmail({
      ...order,
      orderNumber: "K7MQ4XZ2",
      customerLogin: { email: "ola@example.com", password: "WZeMSSoC5EZn" },
    });

    expect(html).toContain("https://otman.no/min-bestilling/K7MQ4XZ2");
    expect(html).toContain("ola@example.com");
    expect(html).toContain("WZeMSSoC5EZn");
    expect(html).not.toContain("egen e-post");
    expect(html).toContain("Ikke del passordet med andre");
  });

  it("tells a returning customer to use their existing password, with a forgot-password link", () => {
    const { html } = buildOrderReceivedEmail({
      ...order,
      orderNumber: "K7MQ4XZ2",
      customerLogin: { email: "ola@example.com", password: null },
    });

    expect(html).toContain("passordet du allerede har");
    expect(html).toContain("https://otman.no/min-bestilling/logg-inn?glemt=1");
    expect(html).not.toContain("egen e-post");
  });

  it("no longer promises a separate approval / payment email — it goes out once the order is paid", () => {
    expect(buildOrderReceivedEmail(order).html).not.toContain("betale og bekrefte");
  });

  const customerLogin = { email: "ola@example.com", password: "WZeMSSoC5EZn" };
  const details = {
    deliveryDate: "2026-10-15",
    timeWindow: "10:00-16:00",
    customerName: "Ola Nordmann",
    phone: "+47 900 00 000",
    email: "ola@example.com",
    pickupAddress: "Elkjøp Lørenskog, Lørenskog",
    extraPickupAddress: ["Power Alnabru, Oslo", "IKEA Furuset, Oslo"],
    deliveryAddress: "Storgata 1, 2000 Lillestrøm",
    returnAddress: "Gjenvinning Grorud, Oslo",
    floorNo: "3",
    lift: "Nei",
    productsSummary: "Washing machine x2, Other furniture (Piano stool)",
    deliveryTypeSummary: "Delivery with carry-in x2",
    servicesSummary: "Unpacking and disposal of packaging",
    customerComments: "Ring på døren",
    totalIncVatNok: 44170,
  };

  it("ends with the order details: date, every address, products, services and total", () => {
    const { html } = buildOrderReceivedEmail({ ...order, orderNumber: "K7MQ4XZ2", orderDetails: details });

    expect(html).toContain("Bestillingsdetaljer");
    expect(html).toContain("15. oktober 2026");
    expect(html).toContain("10:00 - 16:00");
    expect(html).toContain("Elkjøp Lørenskog, Lørenskog");
    expect(html).toContain("Power Alnabru, Oslo");
    expect(html).toContain("IKEA Furuset, Oslo");
    expect(html).toContain("Storgata 1, 2000 Lillestrøm");
    expect(html).toContain("Gjenvinning Grorud, Oslo");
    expect(html).toContain("Vaskemaskin x2, Andre møbler (Piano stool)");
    expect(html).toContain("Levering med innbæring x2");
    expect(html).toContain("Utpakking og kasting av emballasje");
    expect(html).toContain("Ring på døren");
    expect(html).toContain("+47 900 00 000");
    expect(html).toMatch(/44\s170 kr/);
    // The details come last, after the login and the rules.
    expect(html.indexOf("Bestillingsdetaljer")).toBeGreaterThan(html.indexOf("Svar på denne e-posten"));
  });

  it("leaves out empty detail rows, and the price row for an unpriced quote", () => {
    const { html } = buildOrderReceivedEmail({
      ...order,
      orderDetails: { ...details, extraPickupAddress: [], returnAddress: null, customerComments: null, totalIncVatNok: null },
    });

    expect(html).not.toContain("Ekstra hentested");
    expect(html).not.toContain("Returadresse");
    expect(html).not.toContain("Kommentar");
    expect(html).not.toContain("Totalpris");
  });

  it("states until when the order can be changed and cancelled — 24h before the time window starts", () => {
    const { html } = buildOrderReceivedEmail({ ...order, orderNumber: "K7MQ4XZ2", customerLogin, orderDetails: details });

    expect(html).toContain("14. oktober kl. 10:00");
    expect(html).toContain("avbestille");
    expect(html).toContain("legge til tjenester");
  });

  it("states the 24h rule without a date when the order has none", () => {
    const { html } = buildOrderReceivedEmail({ ...order, orderNumber: "K7MQ4XZ2", customerLogin, orderDetails: { ...details, deliveryDate: null } });

    expect(html).toContain("24 timer før");
  });

  it("states x1 on a delivery type that is there once", () => {
    const { html } = buildOrderReceivedEmail({
      ...order,
      orderDetails: { ...details, deliveryTypeSummary: "Delivery with carry-in x2, Delivery to doorstep" },
    });

    expect(html).toContain("Levering med innbæring x2, Levering til ytterdør x1");
  });

  describe("with the booked pickup stops and delivery", () => {
    const stops = {
      pickups: [
        {
          source: "store" as const,
          placeName: "Elkjøp Lørenskog",
          address: "Solheimveien 7, 1473 Lørenskog",
          floor: null,
          liftAvailable: false,
          contactName: "",
          contactPhone: "",
          productNames: ["Vaskemaskin x2"],
        },
        {
          source: "private" as const,
          placeName: "",
          address: "Bjerkeveien 4, 0596 Oslo",
          floor: 3,
          liftAvailable: false,
          contactName: "Kari Nordmann",
          contactPhone: "+47 911 11 111",
          productNames: ["Tørketrommel"],
        },
      ],
      delivery: { address: "Storgata 1, 2000 Lillestrøm", floor: 5, liftAvailable: true },
    };

    it("gives each pickup its own row with its type, place, address, floor and lift, contact person and products", () => {
      const { html } = buildOrderReceivedEmail({ ...order, orderDetails: { ...details, ...stops } });

      expect(html).toContain("Henting 1");
      expect(html).toContain("Henting 2");
      expect(html).toContain("Butikk · Elkjøp Lørenskog");
      expect(html).toContain("Solheimveien 7, 1473 Lørenskog");
      expect(html).toContain("Privatperson");
      expect(html).toContain("Bjerkeveien 4, 0596 Oslo");
      expect(html).toContain("Etasje 3, uten heis");
      expect(html).toContain("Kontaktperson: Kari Nordmann, +47 911 11 111");
      expect(html).toContain("Varer: Tørketrommel");
      // A store has no floor.
      expect(html).not.toContain("Etasje null");
    });

    it("gives the delivery address row its floor and lift", () => {
      const { html } = buildOrderReceivedEmail({ ...order, orderDetails: { ...details, ...stops } });

      expect(html).toContain("Leveringsadresse");
      expect(html).toContain("Storgata 1, 2000 Lillestrøm");
      expect(html).toContain("Etasje 5, med heis");
    });

    it("drops the plain pickup / extra pickup / floor rows it replaces", () => {
      const { html } = buildOrderReceivedEmail({ ...order, orderDetails: { ...details, ...stops } });

      expect(html).not.toContain("Henteadresse");
      expect(html).not.toContain("Ekstra hentested");
      expect(html).not.toContain("heis: Nei");
      expect(html).not.toContain("Power Alnabru, Oslo");
    });

    it("calls a single pickup just Henting", () => {
      const { html } = buildOrderReceivedEmail({ ...order, orderDetails: { ...details, ...stops, pickups: [stops.pickups[1]] } });

      expect(html).toContain(">Henting<");
      expect(html).not.toContain("Henting 1");
    });
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
