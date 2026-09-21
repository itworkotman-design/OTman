import { describe, expect, it } from "vitest";
import {
  WEBSITE_CATALOGS,
  findWebsiteCatalogByProductCode,
  findWebsiteOptionSeed,
  findWebsiteProductSeed,
  getWebsiteCatalog,
  remainingWebsiteCatalogs,
} from "./websiteCatalogs";

describe("WEBSITE_CATALOGS", () => {
  it("offers white goods first, then furniture", () => {
    expect(WEBSITE_CATALOGS.map((c) => c.priceListCode)).toEqual(["WEBSITE_WHITE_GOODS", "WEBSITE_FURNITURE"]);
  });

  it("has bilingual labels and never lists the same product code in two catalogs", () => {
    const seen = new Set<string>();
    for (const catalog of WEBSITE_CATALOGS) {
      expect(catalog.labelEn && catalog.labelNo).toBeTruthy();
      for (const product of catalog.products) {
        expect(seen.has(product.code), product.code).toBe(false);
        seen.add(product.code);
      }
    }
  });
});

describe("lookups", () => {
  it("finds the catalog, product seed and option seed for a product code across both catalogs", () => {
    expect(findWebsiteCatalogByProductCode("WG_DISHWASHER")?.priceListCode).toBe("WEBSITE_WHITE_GOODS");
    expect(findWebsiteCatalogByProductCode("FN_SOFA")?.priceListCode).toBe("WEBSITE_FURNITURE");
    expect(findWebsiteProductSeed("FN_SOFA")?.nameNo).toBe("Sofa");
    expect(findWebsiteOptionSeed("FN_BED", "ASM_SINGLE_BED_IKEA")?.manufacturer).toBe("IKEA");
  });

  it("returns null for a product that isn't sold on the website", () => {
    expect(findWebsiteCatalogByProductCode("DISHWASHER")).toBeNull();
    expect(findWebsiteProductSeed("DISHWASHER")).toBeNull();
    expect(findWebsiteOptionSeed("FN_BED", "NOPE")).toBeNull();
  });

  it("gets a catalog by price list code", () => {
    expect(getWebsiteCatalog("WEBSITE_FURNITURE")?.products).toHaveLength(23);
    expect(getWebsiteCatalog("NOPE")).toBeNull();
  });
});

describe("remainingWebsiteCatalogs", () => {
  it("excludes the lists already used, keeping the original order", () => {
    expect(remainingWebsiteCatalogs(["WEBSITE_WHITE_GOODS"]).map((c) => c.priceListCode)).toEqual(["WEBSITE_FURNITURE"]);
    expect(remainingWebsiteCatalogs([]).map((c) => c.priceListCode)).toEqual(["WEBSITE_WHITE_GOODS", "WEBSITE_FURNITURE"]);
    expect(remainingWebsiteCatalogs(["WEBSITE_WHITE_GOODS", "WEBSITE_FURNITURE"])).toEqual([]);
  });
});
