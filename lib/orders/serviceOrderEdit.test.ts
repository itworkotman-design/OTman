import { describe, expect, it } from "vitest";
import {
  classifyServiceEdit,
  parseServiceEdit,
  serviceEditFromOrder,
  serviceOrderDescription,
  serviceOrderSaveData,
  serviceQuoteItemRows,
} from "./serviceOrderEdit";

const bookingDetails = { version: 1, customerType: "private", serviceCode: "option-1", customService: "", jobDescription: "Install lights." };
const quoteItem = {
  productCode: "SERVICE_QUOTE",
  optionCode: "QUOTE",
  optionLabel: "Electrician",
  quantity: 1,
  customerPriceCents: 400000,
  subcontractorPriceCents: 250000,
};

const edit = {
  serviceCode: "option-1",
  customService: "",
  jobDescription: "Install lights.",
  address: "Storgata 1, Oslo",
  quote: { customer: 4000, partner: 2500 },
};

describe("serviceEditFromOrder", () => {
  it("reads the answers, the address and the quote line", () => {
    expect(
      serviceEditFromOrder({ deliveryAddress: "Storgata 1, Oslo", websiteBookingDetails: bookingDetails, items: [quoteItem] }),
    ).toEqual(edit);
  });

  it("has no quote before staff priced it", () => {
    const read = serviceEditFromOrder({ deliveryAddress: "Storgata 1, Oslo", websiteBookingDetails: bookingDetails, items: [] });
    expect(read?.quote).toEqual({ customer: null, partner: null });
  });

  it("is null for an order without service answers", () => {
    expect(serviceEditFromOrder({ deliveryAddress: "x", websiteBookingDetails: null, items: [] })).toBeNull();
  });
});

describe("parseServiceEdit", () => {
  it("accepts an edit and names the service in English", () => {
    expect(parseServiceEdit(edit)).toEqual({ ok: true, edit, labelEn: "Electrician" });
  });

  it("names a custom service by what was typed", () => {
    const parsed = parseServiceEdit({ ...edit, serviceCode: "custom", customService: " Painter " });
    expect(parsed).toMatchObject({ ok: true, labelEn: "Custom service — Painter", edit: { customService: "Painter" } });
  });

  it("trims the text fields", () => {
    const parsed = parseServiceEdit({ ...edit, address: "  Storgata 1, Oslo ", jobDescription: " Install lights. " });
    expect(parsed).toMatchObject({ ok: true, edit: { address: "Storgata 1, Oslo", jobDescription: "Install lights." } });
  });

  it("allows no quote yet", () => {
    expect(parseServiceEdit({ ...edit, quote: { customer: null, partner: null } }).ok).toBe(true);
  });

  it.each([
    ["serviceCode", { serviceCode: "option-99" }],
    ["customService", { serviceCode: "custom", customService: "" }],
    ["address", { address: " " }],
    ["address", { address: "<b>" }],
    ["jobDescription", { jobDescription: "" }],
    ["quote.customer", { quote: { customer: -1, partner: null } }],
    ["quote.partner", { quote: { customer: 100, partner: "abc" } }],
    ["quote.customer", { quote: { customer: Number.POSITIVE_INFINITY, partner: null } }],
  ])("rejects a bad %s", (field, patch) => {
    const parsed = parseServiceEdit({ ...edit, ...patch });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors).toHaveProperty([field]);
  });
});

describe("serviceQuoteItemRows", () => {
  it("is one line for the service, in øre", () => {
    expect(serviceQuoteItemRows(edit.quote, "Electrician")).toEqual([
      {
        cardId: 0,
        productCode: "SERVICE_QUOTE",
        productName: "Service",
        itemType: "product",
        optionCode: "QUOTE",
        optionLabel: "Electrician",
        quantity: 1,
        customerPriceCents: 400000,
        subcontractorPriceCents: 250000,
      },
    ]);
  });

  it("counts a side left empty as 0", () => {
    expect(serviceQuoteItemRows({ customer: 1000, partner: null }, "Electrician")[0].subcontractorPriceCents).toBe(0);
  });

  it("has no line before a price is given", () => {
    expect(serviceQuoteItemRows({ customer: null, partner: null }, "Electrician")).toEqual([]);
  });
});

describe("serviceOrderDescription", () => {
  it("lists the service, the customer type and the job for staff", () => {
    expect(serviceOrderDescription({ labelEn: "Electrician", customerType: "business", jobDescription: "Install lights." })).toBe(
      "Service: Electrician\n\nCustomer type: Business\n\nInstall lights.",
    );
  });

  it("leaves out a customer type not given", () => {
    expect(serviceOrderDescription({ labelEn: "Electrician", customerType: null, jobDescription: "Install lights." })).toBe(
      "Service: Electrician\n\nInstall lights.",
    );
  });
});

describe("serviceOrderSaveData", () => {
  const parsed = parseServiceEdit(edit);
  if (!parsed.ok) throw new Error("fixture");
  const express = {
    cardId: 0,
    productCode: "MOVING_EXPRESS",
    productName: "Express delivery",
    itemType: "product",
    optionCode: "EXPRESS_DELIVERY",
    optionLabel: "Express delivery",
    quantity: 1,
    customerPriceCents: 150000,
    subcontractorPriceCents: 80000,
  };

  it("writes the answers, the address, the summary and the priced lines", () => {
    const save = serviceOrderSaveData({
      parsed,
      customerType: "business",
      adjustments: { rabatt: "500", leggTil: null, subcontractorMinus: null, subcontractorPlus: null },
      handlingRows: [express],
    });
    expect(save.itemRows.map((r) => r.productCode)).toEqual(["SERVICE_QUOTE", "MOVING_EXPRESS"]);
    expect(save.orderData).toMatchObject({
      deliveryAddress: "Storgata 1, Oslo",
      productsSummary: "Service request (Electrician)",
      description: "Service: Electrician\n\nCustomer type: Business\n\nInstall lights.",
      priceExVat: 5000,
      priceSubcontractor: 3300,
      websiteBookingDetails: { version: 1, customerType: "business", serviceCode: "option-1", customService: "", jobDescription: "Install lights." },
    });
  });
});

describe("classifyServiceEdit (a customer's change in the 24h policy's terms)", () => {
  const answers = { serviceCode: "option-1", customService: "", jobDescription: "Install lights.", address: "Storgata 1, Oslo" };

  it("is nothing when nothing changed (spacing aside)", () => {
    expect(classifyServiceEdit(answers, { ...answers, address: " Storgata 1, Oslo " })).toEqual([]);
  });

  it("counts a new address as an address change", () => {
    expect(classifyServiceEdit(answers, { ...answers, address: "Kirkegata 5, Oslo" })).toEqual(["addresses"]);
  });

  it("counts another service as reconfiguring the order", () => {
    expect(classifyServiceEdit(answers, { ...answers, serviceCode: "custom", customService: "Painter" })).toEqual(["reconfigure"]);
  });

  it("counts a new job description as notes — still allowed close to the job", () => {
    expect(classifyServiceEdit(answers, { ...answers, jobDescription: "Install four lights." })).toEqual(["notes"]);
  });
});
