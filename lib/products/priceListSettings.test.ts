import { describe, expect, it } from "vitest";
import {
  createDefaultPriceListSettings,
  normalizePriceListSettings,
  parsePriceListSettings,
  serializePriceListSettings,
} from "./priceListSettings";

describe("priceListSettings", () => {
  it("includes default deviation customer and subcontractor prices", () => {
    const settings = createDefaultPriceListSettings();

    expect(settings.deviations.NOTHOME).toEqual(
      expect.objectContaining({
        code: "NOTHOME",
        price: "590",
        subcontractorPrice: "390",
      }),
    );
    expect(settings.deviations.WRONGADRESS).toEqual(
      expect.objectContaining({
        code: "WRONGADRESS",
        price: "590",
        subcontractorPrice: "149",
      }),
    );
  });

  it("normalizes partial deviation settings without losing default codes", () => {
    const settings = normalizePriceListSettings({
      deviations: {
        NOTHOME: {
          code: "NOTHOME",
          description: "Deviation, missed trip; Customer not at home",
          price: "650",
          subcontractorPrice: "410",
        },
      },
    });

    expect(settings.deviations.NOTHOME).toEqual(
      expect.objectContaining({
        code: "NOTHOME",
        price: "650",
        subcontractorPrice: "410",
      }),
    );
    expect(settings.deviations.CANCELED?.price).toBe("590");
  });

  it("defaults floorSurcharge to a zero-priced setting", () => {
    const settings = createDefaultPriceListSettings();

    expect(settings.floorSurcharge).toEqual(
      expect.objectContaining({
        code: "FLOOR_SURCHARGE",
        price: "0",
        subcontractorPrice: "0",
      }),
    );
  });

  it("normalizes a custom floorSurcharge setting", () => {
    const settings = normalizePriceListSettings({
      floorSurcharge: {
        code: "FLOOR_SURCHARGE",
        description: "Floor surcharge",
        price: "71.208",
        subcontractorPrice: "29.928",
      },
    });

    expect(settings.floorSurcharge).toEqual(
      expect.objectContaining({
        price: "71.208",
        subcontractorPrice: "29.928",
      }),
    );
  });

  it("round-trips floorSurcharge through price-list description storage", () => {
    const settings = createDefaultPriceListSettings();
    settings.floorSurcharge.price = "71.208";
    settings.floorSurcharge.subcontractorPrice = "29.928";

    const parsed = parsePriceListSettings(serializePriceListSettings(settings));

    expect(parsed.floorSurcharge).toEqual(
      expect.objectContaining({
        price: "71.208",
        subcontractorPrice: "29.928",
      }),
    );
  });

  it("is not delivery-only by default", () => {
    expect(createDefaultPriceListSettings().deliveryOnly).toBe(false);
    expect(normalizePriceListSettings({}).deliveryOnly).toBe(false);
    expect(normalizePriceListSettings(null).deliveryOnly).toBe(false);
    // A price list stored before the flag existed has no such key.
    expect(parsePriceListSettings(null).deliveryOnly).toBe(false);
  });

  it("only treats a real boolean true as delivery-only", () => {
    expect(normalizePriceListSettings({ deliveryOnly: true }).deliveryOnly).toBe(true);
    expect(
      normalizePriceListSettings({ deliveryOnly: "true" as unknown as boolean }).deliveryOnly,
    ).toBe(false);
  });

  it("round-trips deliveryOnly through price-list description storage", () => {
    const settings = createDefaultPriceListSettings();
    settings.deliveryOnly = true;

    expect(parsePriceListSettings(serializePriceListSettings(settings)).deliveryOnly).toBe(true);
  });

  it("round-trips deviation settings through price-list description storage", () => {
    const settings = createDefaultPriceListSettings();
    settings.deviations.NOTHOME.price = "650";
    settings.deviations.NOTHOME.subcontractorPrice = "410";

    const parsed = parsePriceListSettings(serializePriceListSettings(settings));

    expect(parsed.deviations.NOTHOME).toEqual(
      expect.objectContaining({
        price: "650",
        subcontractorPrice: "410",
      }),
    );
  });
});
