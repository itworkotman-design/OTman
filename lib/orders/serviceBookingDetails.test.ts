import { describe, expect, it } from "vitest";
import {
  buildServiceBookingDetails,
  parseServiceBookingDetails,
  parseServiceRequestItems,
  SERVICE_ORDER_KIND,
} from "./serviceBookingDetails";

const electrician = { serviceCode: "option-1", customService: "", jobDescription: "Install three ceiling lights." };
const carpenter = { serviceCode: "option-2", customService: "", jobDescription: "Fix the bedroom door." };

describe("service booking details (what a homepage service request answered)", () => {
  const details = { customerType: "business" as const, services: [electrician, carpenter] };

  it("is its own website order kind", () => {
    expect(SERVICE_ORDER_KIND).toBe("SERVICE");
  });

  it("reads back what it stored — every service with its own job", () => {
    const stored = buildServiceBookingDetails(details);
    expect(stored).toEqual({ version: 2, ...details });
    expect(parseServiceBookingDetails(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it("keeps a custom service's name, and drops it for a listed one", () => {
    const stored = buildServiceBookingDetails({
      ...details,
      services: [{ ...electrician, customService: "leftover" }, { serviceCode: "custom", customService: " Painter ", jobDescription: "Paint the hall." }],
    });
    expect(stored.services.map((s) => s.customService)).toEqual(["", "Painter"]);
  });

  it("reads a single-service request stored before services were a list", () => {
    expect(parseServiceBookingDetails({ version: 1, customerType: "private", ...electrician })).toEqual({
      version: 2,
      customerType: "private",
      services: [electrician],
    });
  });

  it.each([
    ["nothing", null],
    ["an array", []],
    ["another version", { ...details, version: 3 }],
    ["no services", { version: 2, customerType: null, services: [] }],
    ["an unknown service", { version: 2, customerType: null, services: [{ ...electrician, serviceCode: "option-99" }] }],
    ["a custom service without its name", { version: 2, customerType: null, services: [{ serviceCode: "custom", customService: "", jobDescription: "x" }] }],
    ["a job description that isn't text", { version: 2, customerType: null, services: [{ ...electrician, jobDescription: 5 }] }],
  ])("rejects %s", (_label, value) => {
    expect(parseServiceBookingDetails(value)).toBeNull();
  });

  it("keeps an unknown customer type as not given", () => {
    expect(parseServiceBookingDetails({ ...details, version: 2, customerType: "other" })?.customerType).toBeNull();
  });
});

describe("parseServiceRequestItems (the services a request or an edit sends)", () => {
  it("accepts several services, trimmed, each with its English label", () => {
    const parsed = parseServiceRequestItems([
      { ...electrician, jobDescription: " Install lights. " },
      { serviceCode: "custom", customService: " Painter ", jobDescription: "Paint the hall." },
    ]);
    expect(parsed).toEqual({
      ok: true,
      items: [
        { serviceCode: "option-1", customService: "", jobDescription: "Install lights.", labelEn: "Electrician" },
        { serviceCode: "custom", customService: "Painter", jobDescription: "Paint the hall.", labelEn: "Custom service — Painter" },
      ],
    });
  });

  it.each([
    ["services", "not a list", "Required"],
    ["services", [], "Required"],
    ["services", [electrician, electrician], "Duplicate service"],
    ["services.0.serviceCode", [{ ...electrician, serviceCode: "option-99" }], "Unknown service"],
    ["services.1.customService", [electrician, { serviceCode: "custom", customService: "", jobDescription: "x" }], "Required"],
    ["services.0.jobDescription", [{ ...electrician, jobDescription: " " }], "Required"],
    ["services.0.jobDescription", [{ ...electrician, jobDescription: "<b>" }], "Contains disallowed characters"],
  ])("rejects a bad %s", (field, raw, message) => {
    const parsed = parseServiceRequestItems(raw);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors[field]).toBe(message);
  });
});
