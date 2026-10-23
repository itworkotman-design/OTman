import { describe, expect, it } from "vitest";
import { createDefaultPriceListSettings } from "@/lib/products/priceListSettings";
import { websiteInclVat } from "./websiteVat";
import {
  cleanWebsiteDeliveryTypes,
  cleanWebsiteExVatPrice,
  cleanWebsitePriceListSettings,
  cleanWebsitePriceString,
} from "./websiteCleanPrice";

describe("cleanWebsiteExVatPrice", () => {
  it("raises the ex-VAT price so the customer's price (incl. VAT) ends in 0", () => {
    expect(cleanWebsiteExVatPrice(260)).toBe(264);
    expect(websiteInclVat(264)).toBe(330);
    expect(cleanWebsiteExVatPrice(609)).toBe(616);
    expect(cleanWebsiteExVatPrice(103.2)).toBe(104);
  });

  it("leaves a price that is already clean, and 0, as is", () => {
    expect(cleanWebsiteExVatPrice(264)).toBe(264);
    expect(cleanWebsiteExVatPrice(800)).toBe(800);
    expect(cleanWebsiteExVatPrice(0)).toBe(0);
  });

  it("always gives a customer price ending in 0", () => {
    for (let price = 1; price <= 3000; price += 7.3) {
      expect(websiteInclVat(cleanWebsiteExVatPrice(price)) % 10).toBe(0);
    }
  });
});

describe("cleanWebsitePriceString", () => {
  it("cleans a stored price string and leaves non-numbers alone", () => {
    expect(cleanWebsitePriceString("260")).toBe("264");
    expect(cleanWebsitePriceString("260,50")).toBe("264");
    expect(cleanWebsitePriceString("0")).toBe("0");
    expect(cleanWebsitePriceString("")).toBe("");
    expect(cleanWebsitePriceString("abc")).toBe("abc");
  });
});

describe("cleanWebsiteDeliveryTypes", () => {
  it("cleans the customer prices only, keeping partner prices and other fields", () => {
    const stored = [
      { key: "FIRST_STEP", price: "610", subcontractorPrice: "400", xtraPrice: "155", xtraSubcontractorPrice: "105", enabled: true },
    ];
    expect(cleanWebsiteDeliveryTypes(stored)).toEqual([
      { key: "FIRST_STEP", price: "616", subcontractorPrice: "400", xtraPrice: "160", xtraSubcontractorPrice: "105", enabled: true },
    ]);
  });

  it("lowers installation only instead, so it stays under the doorstep price it's set just below", () => {
    const stored = [{ key: "INSTALL_ONLY", price: "609", subcontractorPrice: "400", xtraPrice: "0" }];
    expect(cleanWebsiteDeliveryTypes(stored)).toEqual([{ key: "INSTALL_ONLY", price: "608", subcontractorPrice: "400", xtraPrice: "0" }]);
  });

  it("returns anything that isn't a list unchanged", () => {
    expect(cleanWebsiteDeliveryTypes(null)).toBeNull();
  });
});

describe("cleanWebsitePriceListSettings", () => {
  it("cleans the fees but not the per-km rates or partner prices", () => {
    const settings = createDefaultPriceListSettings();
    settings.expressDelivery = { ...settings.expressDelivery, price: "500", subcontractorPrice: "300" };
    settings.kmFrom21 = { ...settings.kmFrom21, price: "15" };
    settings.deviations = { WAIT: { code: "WAIT", description: "Waiting", price: "250", subcontractorPrice: "150" } };

    const cleaned = cleanWebsitePriceListSettings(settings);

    expect(cleaned.expressDelivery).toMatchObject({ price: "504", subcontractorPrice: "300" });
    expect(cleaned.xtraPallet.price).toBe("256");
    expect(cleaned.kmFrom21.price).toBe("15");
    expect(cleaned.deviations.WAIT).toMatchObject({ price: "256", subcontractorPrice: "150" });
  });
});
