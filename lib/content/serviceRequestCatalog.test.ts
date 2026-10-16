import { describe, expect, it } from "vitest";
import { TjenesterContent } from "./TjenesterContent";
import {
  SERVICE_REQUEST_CUSTOM_CODE,
  SERVICE_REQUEST_OPTIONS,
  isServiceChoiceReady,
  parseServiceChoice,
  serviceRequestLabel,
} from "./serviceRequestCatalog";

describe("SERVICE_REQUEST_OPTIONS", () => {
  it("offers every service from the services page, in the same order, each with an icon", () => {
    expect(SERVICE_REQUEST_OPTIONS.map((o) => o.code)).toEqual(TjenesterContent.jobTypeOptions.map((o) => o.value));
    expect(SERVICE_REQUEST_OPTIONS.map((o) => o.labelNo)).toEqual(TjenesterContent.jobTypeOptions.map((o) => o.label.no));
    for (const option of SERVICE_REQUEST_OPTIONS) expect(option.iconKey).toBeTruthy();
  });

  it("ends with the custom service", () => {
    expect(SERVICE_REQUEST_OPTIONS.at(-1)?.code).toBe(SERVICE_REQUEST_CUSTOM_CODE);
  });
});

describe("isServiceChoiceReady", () => {
  it("is false until a service is picked", () => {
    expect(isServiceChoiceReady(null, "")).toBe(false);
  });

  it("is true for a regular service on its own", () => {
    expect(isServiceChoiceReady("option-1", "")).toBe(true);
  });

  it("needs a description for the custom service", () => {
    expect(isServiceChoiceReady(SERVICE_REQUEST_CUSTOM_CODE, "  ")).toBe(false);
    expect(isServiceChoiceReady(SERVICE_REQUEST_CUSTOM_CODE, "Painter")).toBe(true);
  });

  it("is false for a code that isn't offered", () => {
    expect(isServiceChoiceReady("nope", "")).toBe(false);
  });
});

describe("serviceRequestLabel", () => {
  it("returns the service's label in the given language", () => {
    expect(serviceRequestLabel("option-3", "", "no")).toBe("Rørlegger");
    expect(serviceRequestLabel("option-3", "", "en")).toBe("Plumber");
  });

  it("appends what the customer typed for the custom service", () => {
    expect(serviceRequestLabel(SERVICE_REQUEST_CUSTOM_CODE, " Painter ", "en")).toBe("Custom service — Painter");
  });

  it("returns null when nothing valid is picked", () => {
    expect(serviceRequestLabel(null, "", "en")).toBeNull();
    expect(serviceRequestLabel("nope", "", "en")).toBeNull();
  });
});

describe("parseServiceChoice", () => {
  it("accepts a regular service and returns its English label", () => {
    expect(parseServiceChoice("option-5", undefined)).toEqual({ ok: true, code: "option-5", customService: "", labelEn: "Cleaning Services" });
  });

  it("rejects a missing or unknown service code", () => {
    expect(parseServiceChoice("", "")).toEqual({ ok: false, errors: { serviceCode: "Required" } });
    expect(parseServiceChoice("option-99", "")).toEqual({ ok: false, errors: { serviceCode: "Unknown service" } });
  });

  it("requires a short description for the custom service", () => {
    expect(parseServiceChoice(SERVICE_REQUEST_CUSTOM_CODE, "")).toEqual({ ok: false, errors: { customService: "Required" } });
    expect(parseServiceChoice(SERVICE_REQUEST_CUSTOM_CODE, "x".repeat(201))).toEqual({
      ok: false,
      errors: { customService: "Maximum 200 characters" },
    });
    expect(parseServiceChoice(SERVICE_REQUEST_CUSTOM_CODE, " Painter ")).toEqual({
      ok: true,
      code: SERVICE_REQUEST_CUSTOM_CODE,
      customService: "Painter",
      labelEn: "Custom service — Painter",
    });
  });

  it("drops a custom description sent along with a regular service", () => {
    expect(parseServiceChoice("option-1", "Painter")).toMatchObject({ ok: true, customService: "" });
  });
});
