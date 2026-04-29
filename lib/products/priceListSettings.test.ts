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
