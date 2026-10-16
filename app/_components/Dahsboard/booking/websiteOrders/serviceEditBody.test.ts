import { describe, expect, it } from "vitest";
import { serviceEditBlockers, serviceEditBody, type ServiceEditDraft } from "./serviceEditBody";

const electrician = { serviceCode: "option-1", customService: "", jobDescription: "Install lights.", quote: { customer: null, partner: null } };
const initial: ServiceEditDraft = {
  edit: { address: "Storgata 1, Oslo", services: [electrician] },
  customer: { name: "Kari", phone: "+4712345678", email: "kari@example.com", comments: "" },
  customerType: "private",
  schedule: { preferredDate: "2026-10-22", timeWindow: "08:00-16:00" },
};

describe("serviceEditBody (what the service Edit tab saves)", () => {
  it("is empty while nothing changed", () => {
    expect(serviceEditBody(initial, initial)).toEqual({});
  });

  it("sends the request as a whole when a quote changes", () => {
    const current = { ...initial, edit: { ...initial.edit, services: [{ ...electrician, quote: { customer: 3200, partner: 2000 } }] } };
    expect(serviceEditBody(initial, current)).toEqual({ edit: current.edit });
  });

  it("sends only the parts that changed", () => {
    const current = {
      ...initial,
      customer: { ...initial.customer, name: "Ola" },
      customerType: "business" as const,
      schedule: { ...initial.schedule, timeWindow: "10:00-14:00" },
    };
    expect(serviceEditBody(initial, current)).toEqual({
      customer: current.customer,
      customerType: "business",
      preferredDate: "2026-10-22",
      timeWindow: "10:00-14:00",
    });
  });
});

describe("serviceEditBlockers (what keeps Save disabled)", () => {
  it("has none for a complete request", () => {
    expect(serviceEditBlockers(initial)).toEqual([]);
  });

  it("wants at least one service", () => {
    expect(serviceEditBlockers({ ...initial, edit: { ...initial.edit, services: [] } })).toEqual(["services"]);
  });

  it("names every missing answer, per service", () => {
    const custom = { serviceCode: "custom", customService: " ", jobDescription: "", quote: { customer: null, partner: null } };
    const draft = { ...initial, edit: { address: "", services: [electrician, custom] } };
    expect(serviceEditBlockers(draft).sort()).toEqual(["address", "services.1.customService", "services.1.jobDescription"]);
  });

  it("rejects a negative price", () => {
    const draft = { ...initial, edit: { ...initial.edit, services: [{ ...electrician, quote: { customer: -5, partner: null } }] } };
    expect(serviceEditBlockers(draft)).toEqual(["services.0.quote"]);
  });

  it("wants a complete custom time window", () => {
    expect(serviceEditBlockers({ ...initial, schedule: { ...initial.schedule, timeWindow: "12:00-" } })).toEqual(["timeWindow"]);
  });
});
