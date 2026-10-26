import { describe, expect, it } from "vitest";
import {
  AUTOMATIC_SMS_TEMPLATE_DEFAULTS,
  buildSmsTemplateVariables,
  findMissingPlaceholders,
  renderSmsTemplate,
  renderOrderSms,
} from "./templates";

const order = {
  displayId: 20123,
  orderNumber: "PB-77",
  customerName: "Kari Nordmann",
  deliveryDate: "2026-10-26",
  timeWindow: "10:00-14:00",
  deliveryAddress: "Storgata 1, 0155 Oslo",
  productsSummary: "Kjøleskap x2",
  deliveryTypeSummary: "Innbæring",
  servicesSummary: "Montering, Retur av gammel",
};

describe("buildSmsTemplateVariables", () => {
  it("maps order fields to placeholder values", () => {
    expect(buildSmsTemplateVariables(order)).toEqual({
      name: "Kari Nordmann",
      address: "Storgata 1, 0155 Oslo",
      date: "26.10.2026",
      timeWindow: "10:00 - 14:00",
      products: "Kjøleskap x2",
      deliveryType: "Innbæring",
      services: "Montering, Retur av gammel",
      job: "Kjøleskap x2 (Innbæring)",
      orderId: "20123",
      orderNumber: "PB-77",
    });
  });

  it("leaves the address empty when there is no delivery address (never uses the pickup address)", () => {
    const withPickup = { ...order, deliveryAddress: null, pickupAddress: "Lager 5, Lillestrøm" };
    expect(buildSmsTemplateVariables(withPickup).address).toBe("");
  });

  it("lists the placeholders used in the text whose value is empty, once each, in order of use", () => {
    const vars = buildSmsTemplateVariables({ ...order, customerName: null, deliveryAddress: "  " });
    expect(findMissingPlaceholders("Hei {name}! {address} {date} {address} {name}", vars)).toEqual(["name", "address"]);
  });

  it("ignores unknown placeholders and filled ones when looking for missing values", () => {
    const vars = buildSmsTemplateVariables(order);
    expect(findMissingPlaceholders("Hei {name} {nmae} på {address}", vars)).toEqual([]);
  });

  it("builds job from products and delivery type only — services are left out", () => {
    expect(buildSmsTemplateVariables({ ...order, deliveryTypeSummary: null }).job).toBe("Kjøleskap x2");
    expect(buildSmsTemplateVariables({ ...order, productsSummary: "" }).job).toBe("Innbæring");
    expect(buildSmsTemplateVariables({ ...order, productsSummary: null, deliveryTypeSummary: null }).job).toBe("");
  });
});

describe("renderSmsTemplate", () => {
  it("replaces known placeholders and leaves unknown ones untouched", () => {
    expect(renderSmsTemplate("Hei {name}, {unknown}", { name: "Kari" })).toBe("Hei Kari, {unknown}");
  });

  it("tidies punctuation left behind by empty placeholders", () => {
    expect(renderSmsTemplate("Vi kommer i dag ({timeWindow}) til {address} .", { timeWindow: "", address: "Storgata 1" })).toBe(
      "Vi kommer i dag til Storgata 1.",
    );
    expect(renderSmsTemplate("Hei {name} , velkommen", { name: "" })).toBe("Hei, velkommen");
  });

  it("keeps line breaks", () => {
    expect(renderSmsTemplate("Hei {name}\nMvh Otman", { name: "Kari" })).toBe("Hei Kari\nMvh Otman");
  });
});

describe("AUTOMATIC_SMS_TEMPLATE_DEFAULTS", () => {
  it("gives each automatic template a title and a description of when it is sent", () => {
    expect(AUTOMATIC_SMS_TEMPLATE_DEFAULTS.DAY_OF_DELIVERY.name).toBe("Automatic SMS on delivery day");
    expect(AUTOMATIC_SMS_TEMPLATE_DEFAULTS.DAY_OF_DELIVERY.description).toMatch(/09:00/);
    expect(AUTOMATIC_SMS_TEMPLATE_DEFAULTS.REVIEW_REQUEST.name).toBe("Automatic review request after completion");
    expect(AUTOMATIC_SMS_TEMPLATE_DEFAULTS.REVIEW_REQUEST.description).toMatch(/GSM/);
  });
});

describe("renderOrderSms", () => {
  it("renders the default day-of-delivery template with the address and the job", () => {
    const text = renderOrderSms(AUTOMATIC_SMS_TEMPLATE_DEFAULTS.DAY_OF_DELIVERY.body, order);
    expect(text).toContain("Kari Nordmann");
    expect(text).toContain("i dag");
    expect(text).toContain("Storgata 1, 0155 Oslo");
    expect(text).toContain("Oppdrag: Kjøleskap x2 (Innbæring).");
    expect(text).not.toContain("Montering");
    expect(text).not.toMatch(/\{\w+\}/);
  });

  it("renders the default review request with the customer's name and the otman.no/reviews link", () => {
    const text = renderOrderSms(AUTOMATIC_SMS_TEMPLATE_DEFAULTS.REVIEW_REQUEST.body, order);
    expect(text).toContain("Kari Nordmann");
    expect(text).toContain("https://otman.no/reviews");
    expect(text).not.toMatch(/\{\w+\}/);
  });
});
