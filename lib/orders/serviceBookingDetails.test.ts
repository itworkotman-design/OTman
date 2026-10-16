import { describe, expect, it } from "vitest";
import { buildServiceBookingDetails, parseServiceBookingDetails, SERVICE_ORDER_KIND } from "./serviceBookingDetails";

describe("service booking details (what a homepage service request answered)", () => {
  const details = {
    customerType: "business" as const,
    serviceCode: "option-1",
    customService: "",
    jobDescription: "Install three ceiling lights.",
  };

  it("is its own website order kind", () => {
    expect(SERVICE_ORDER_KIND).toBe("SERVICE");
  });

  it("reads back what it stored", () => {
    const stored = buildServiceBookingDetails(details);
    expect(stored).toEqual({ version: 1, ...details });
    expect(parseServiceBookingDetails(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it("keeps a custom service's name", () => {
    const stored = buildServiceBookingDetails({ ...details, serviceCode: "custom", customService: "Painter" });
    expect(parseServiceBookingDetails(stored)?.customService).toBe("Painter");
  });

  it("drops the custom name for a listed service", () => {
    expect(buildServiceBookingDetails({ ...details, customService: "leftover" }).customService).toBe("");
  });

  it.each([
    ["nothing", null],
    ["an array", []],
    ["another version", { ...details, version: 2 }],
    ["an unknown service", { version: 1, ...details, serviceCode: "option-99" }],
    ["a custom service without its name", { version: 1, ...details, serviceCode: "custom", customService: "" }],
    ["a job description that isn't text", { version: 1, ...details, jobDescription: 5 }],
  ])("rejects %s", (_label, value) => {
    expect(parseServiceBookingDetails(value)).toBeNull();
  });

  it("keeps an unknown customer type as not given", () => {
    expect(parseServiceBookingDetails({ version: 1, ...details, customerType: "other" })?.customerType).toBeNull();
  });
});
