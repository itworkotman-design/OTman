import { describe, expect, it } from "vitest";
import {
  classifyServiceEdit,
  parseServiceEdit,
  serviceAnswersOf,
  serviceEditFromOrder,
  serviceOrderDescription,
  serviceOrderSaveData,
  serviceOrderSummary,
  serviceQuoteItemRows,
} from "./serviceOrderEdit";

const bookingDetails = {
  version: 2,
  customerType: "private",
  services: [
    { serviceCode: "option-1", customService: "", jobDescription: "Install lights." },
    { serviceCode: "option-2", customService: "", jobDescription: "Fix the door." },
  ],
};
const quoteItem = (code: string, label: string, customerPriceCents: number, subcontractorPriceCents: number) => ({
  productCode: "SERVICE_QUOTE",
  optionCode: `QUOTE:${code}`,
  optionLabel: label,
  quantity: 1,
  customerPriceCents,
  subcontractorPriceCents,
});

const edit = {
  address: "Storgata 1, Oslo",
  services: [
    { serviceCode: "option-1", customService: "", jobDescription: "Install lights.", quote: { customer: 4000, partner: 2500 } },
    { serviceCode: "option-2", customService: "", jobDescription: "Fix the door.", quote: { customer: null, partner: null } },
  ],
};

describe("serviceEditFromOrder", () => {
  it("reads every service with its own quote line, and the address", () => {
    expect(
      serviceEditFromOrder({
        deliveryAddress: "Storgata 1, Oslo",
        websiteBookingDetails: bookingDetails,
        items: [quoteItem("option-1", "Electrician", 400000, 250000)],
      }),
    ).toEqual(edit);
  });

  it("reads the one quote line of a request stored before services were a list", () => {
    const read = serviceEditFromOrder({
      deliveryAddress: "x",
      websiteBookingDetails: { version: 1, customerType: null, serviceCode: "option-1", customService: "", jobDescription: "Install lights." },
      items: [{ ...quoteItem("option-1", "Electrician", 400000, 250000), optionCode: "QUOTE" }],
    });
    expect(read?.services[0].quote).toEqual({ customer: 4000, partner: 2500 });
  });

  it("is null for an order without service answers", () => {
    expect(serviceEditFromOrder({ deliveryAddress: "x", websiteBookingDetails: null, items: [] })).toBeNull();
  });
});

describe("parseServiceEdit", () => {
  it("accepts an edit and names each service in English", () => {
    expect(parseServiceEdit(edit)).toEqual({ ok: true, edit, labels: ["Electrician", "Carpenter"] });
  });

  it("trims the address", () => {
    expect(parseServiceEdit({ ...edit, address: "  Storgata 1, Oslo " })).toMatchObject({ ok: true, edit: { address: "Storgata 1, Oslo" } });
  });

  it.each([
    ["address", { address: " " }],
    ["services", { services: [] }],
    ["services.0.jobDescription", { services: [{ ...edit.services[0], jobDescription: "" }] }],
    ["services.0.quote.customer", { services: [{ ...edit.services[0], quote: { customer: -1, partner: null } }] }],
    ["services.0.quote.partner", { services: [{ ...edit.services[0], quote: { customer: 100, partner: "abc" } }] }],
  ])("rejects a bad %s", (field, patch) => {
    const parsed = parseServiceEdit({ ...edit, ...patch });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors).toHaveProperty([field]);
  });
});

describe("serviceQuoteItemRows", () => {
  it("is one line per priced service, in øre, keyed by its service", () => {
    expect(serviceQuoteItemRows(edit.services, ["Electrician", "Carpenter"])).toEqual([
      {
        cardId: 0,
        productCode: "SERVICE_QUOTE",
        productName: "Service",
        itemType: "product",
        optionCode: "QUOTE:option-1",
        optionLabel: "Electrician",
        quantity: 1,
        customerPriceCents: 400000,
        subcontractorPriceCents: 250000,
      },
    ]);
  });

  it("counts a side left empty as 0", () => {
    const rows = serviceQuoteItemRows([{ ...edit.services[0], quote: { customer: 1000, partner: null } }], ["Electrician"]);
    expect(rows[0].subcontractorPriceCents).toBe(0);
  });
});

describe("serviceOrderDescription / serviceOrderSummary", () => {
  const services = [
    { labelEn: "Electrician", jobDescription: "Install lights." },
    { labelEn: "Carpenter", jobDescription: "Fix the door." },
  ];

  it("lists the customer type, then each service with its job, for staff", () => {
    expect(serviceOrderDescription({ customerType: "business", services })).toBe(
      "Customer type: Business\n\nService: Electrician\nInstall lights.\n\nService: Carpenter\nFix the door.",
    );
  });

  it("leaves out a customer type not given", () => {
    expect(serviceOrderDescription({ customerType: null, services: services.slice(0, 1) })).toBe("Service: Electrician\nInstall lights.");
  });

  it("names every service in the summary", () => {
    expect(serviceOrderSummary(["Electrician", "Carpenter"])).toBe("Service request (Electrician + Carpenter)");
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
      productsSummary: "Service request (Electrician + Carpenter)",
      priceExVat: 5000,
      priceSubcontractor: 3300,
      websiteBookingDetails: {
        version: 2,
        customerType: "business",
        services: [
          { serviceCode: "option-1", customService: "", jobDescription: "Install lights." },
          { serviceCode: "option-2", customService: "", jobDescription: "Fix the door." },
        ],
      },
    });
  });
});

describe("classifyServiceEdit (a customer's change in the 24h policy's terms)", () => {
  const answers = serviceAnswersOf(edit);

  it("leaves out staff's quotes", () => {
    expect(answers).toEqual({
      address: "Storgata 1, Oslo",
      services: [
        { serviceCode: "option-1", customService: "", jobDescription: "Install lights." },
        { serviceCode: "option-2", customService: "", jobDescription: "Fix the door." },
      ],
    });
  });

  it("is nothing when nothing changed (spacing aside)", () => {
    expect(classifyServiceEdit(answers, { ...answers, address: " Storgata 1, Oslo " })).toEqual([]);
  });

  it("counts a new address as an address change", () => {
    expect(classifyServiceEdit(answers, { ...answers, address: "Kirkegata 5, Oslo" })).toEqual(["addresses"]);
  });

  it("counts adding or removing a service as reconfiguring the order", () => {
    expect(classifyServiceEdit(answers, { ...answers, services: answers.services.slice(0, 1) })).toEqual(["reconfigure"]);
    const plumber = { serviceCode: "option-3", customService: "", jobDescription: "Fix the tap." };
    expect(classifyServiceEdit(answers, { ...answers, services: [...answers.services, plumber] })).toEqual(["reconfigure"]);
  });

  it("counts a new job description as notes — still allowed close to the job", () => {
    const services = [answers.services[0], { ...answers.services[1], jobDescription: "Fix both doors." }];
    expect(classifyServiceEdit(answers, { ...answers, services })).toEqual(["notes"]);
  });
});
