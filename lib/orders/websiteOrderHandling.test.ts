import { describe, expect, it } from "vitest";
import {
  handlingChange,
  handlingFromOrder,
  handlingOrderData,
  parseWebsiteOrderHandling,
  type WebsiteOrderHandling,
} from "./websiteOrderHandling";

const handling: WebsiteOrderHandling = {
  driver: "Per",
  secondDriver: "Pål",
  driverInfo: "Ring 10 min før",
  licensePlate: "EL 12345",
  deviation: "",
  customDeviation: { price: null, subcontractorPrice: null, description: null },
  dontSendEmail: false,
  description: "Intern merknad",
  expressDelivery: true,
  rabatt: "100",
  leggTil: "",
};

describe("parseWebsiteOrderHandling", () => {
  it("accepts and trims the admin's handling fields", () => {
    expect(parseWebsiteOrderHandling({ ...handling, driver: "  Per " })).toEqual({ ok: true, handling });
  });

  it("allows everything empty", () => {
    const empty = parseWebsiteOrderHandling({});
    expect(empty).toEqual({
      ok: true,
      handling: {
        driver: "",
        secondDriver: "",
        driverInfo: "",
        licensePlate: "",
        deviation: "",
        customDeviation: { price: null, subcontractorPrice: null, description: null },
        dontSendEmail: false,
        description: "",
        expressDelivery: false,
        rabatt: "",
        leggTil: "",
      },
    });
  });

  it("takes discount / extra as kroner, comma or dot", () => {
    expect(parseWebsiteOrderHandling({ rabatt: "99,50", leggTil: "20" })).toMatchObject({
      ok: true,
      handling: { rabatt: "99.50", leggTil: "20" },
    });
    expect(parseWebsiteOrderHandling({ rabatt: "abc", leggTil: "-5" })).toMatchObject({
      ok: false,
      errors: { rabatt: expect.any(String), leggTil: expect.any(String) },
    });
  });

  it("only accepts a known deviation, and keeps custom prices only for the custom one", () => {
    expect(parseWebsiteOrderHandling({ deviation: "Something made up" })).toMatchObject({
      ok: false,
      errors: { deviation: expect.any(String) },
    });
    expect(
      parseWebsiteOrderHandling({
        deviation: "Custom",
        customDeviation: { price: "400", subcontractorPrice: 200, description: " Ventetid " },
      }),
    ).toMatchObject({ ok: true, handling: { customDeviation: { price: 400, subcontractorPrice: 200, description: "Ventetid" } } });
    expect(
      parseWebsiteOrderHandling({
        deviation: "Avvik, bomtur; Kunde ikke hjemme",
        customDeviation: { price: 400, subcontractorPrice: 200, description: "x" },
      }),
    ).toMatchObject({ ok: true, handling: { customDeviation: { price: null, subcontractorPrice: null, description: null } } });
  });
});

describe("handlingOrderData / handlingFromOrder", () => {
  it("writes the order columns (empty text as null) and reads them back", () => {
    const data = handlingOrderData(handling);
    expect(data).toEqual({
      driver: "Per",
      secondDriver: "Pål",
      driverInfo: "Ring 10 min før",
      licensePlate: "EL 12345",
      deviation: null,
      dontSendEmail: false,
      description: "Intern merknad",
      expressDelivery: true,
      rabatt: "100",
      leggTil: null,
    });
    expect(handlingFromOrder({ ...data, pricingSnapshot: null })).toEqual(handling);
  });

  it("reads a custom deviation's prices from the stored pricing", () => {
    expect(
      handlingFromOrder({
        ...handlingOrderData(handling),
        deviation: "Custom",
        pricingSnapshot: { customDeviationPrice: 400, customDeviationSubcontractorPrice: 200, customDeviationDescription: "Ventetid" },
      }).customDeviation,
    ).toEqual({ price: 400, subcontractorPrice: 200, description: "Ventetid" });
  });
});

describe("handlingChange", () => {
  it("is unchanged for the same values", () => {
    expect(handlingChange(handling, { ...handling })).toEqual({ changed: false, affectsPrice: false });
  });

  it("changes without touching the price for driver, plate, notes…", () => {
    expect(handlingChange(handling, { ...handling, driver: "Ola", description: "Ny" })).toEqual({
      changed: true,
      affectsPrice: false,
    });
  });

  it("affects the price for express, discount, extra and the deviation", () => {
    for (const next of [
      { ...handling, expressDelivery: false },
      { ...handling, rabatt: "200" },
      { ...handling, leggTil: "10" },
      { ...handling, deviation: "Custom" },
      { ...handling, customDeviation: { price: 1, subcontractorPrice: null, description: null } },
    ]) {
      expect(handlingChange(handling, next)).toEqual({ changed: true, affectsPrice: true });
    }
  });
});
