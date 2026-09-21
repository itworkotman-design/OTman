import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultPriceListSettings } from "@/lib/products/priceListSettings";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getBookingCatalog: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { priceList: { findMany: mocks.findMany } } }));
vi.mock("@/lib/booking/catalog/getBookingCatalog", () => ({ getBookingCatalog: mocks.getBookingCatalog }));

import { getWebsiteCatalogPart, getWebsiteOrderCatalog, listSeededWebsiteCatalogs } from "./websiteOrderCatalog";

const p = (id: string, code: string) => ({ id, code, label: code, options: [] });

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  // Every catalog fetch returns ALL products (the real one isn't list-scoped).
  mocks.getBookingCatalog.mockImplementation(async (id: string) => ({
    products: [p("1", "WG_DISHWASHER"), p("2", "FN_SOFA"), p("3", "DISHWASHER")],
    specialOptions: [{ id: `special-${id}` }],
    priceListSettings: createDefaultPriceListSettings(),
  }));
});

describe("listSeededWebsiteCatalogs", () => {
  it("returns only registry catalogs whose price list exists, in registry order", async () => {
    mocks.findMany.mockResolvedValue([{ id: "pl-wg", code: "WEBSITE_WHITE_GOODS" }]);
    const seeded = await listSeededWebsiteCatalogs();
    expect(seeded.map((s) => s.catalog.priceListCode)).toEqual(["WEBSITE_WHITE_GOODS"]);

    mocks.findMany.mockResolvedValue([
      { id: "pl-fn", code: "WEBSITE_FURNITURE" },
      { id: "pl-wg", code: "WEBSITE_WHITE_GOODS" },
    ]);
    const both = await listSeededWebsiteCatalogs();
    expect(both.map((s) => s.catalog.priceListCode)).toEqual(["WEBSITE_WHITE_GOODS", "WEBSITE_FURNITURE"]);
  });
});

describe("getWebsiteCatalogPart", () => {
  it("returns only that list's own products, never the dashboard's or another list's", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "pl-wg", code: "WEBSITE_WHITE_GOODS" },
      { id: "pl-fn", code: "WEBSITE_FURNITURE" },
    ]);
    const part = await getWebsiteCatalogPart("WEBSITE_FURNITURE");
    expect(part?.priceListId).toBe("pl-fn");
    expect(part?.products.map((x) => x.code)).toEqual(["FN_SOFA"]);
    expect(mocks.getBookingCatalog).toHaveBeenCalledWith("pl-fn");
  });

  it("returns null for a list that isn't seeded or isn't a website list", async () => {
    mocks.findMany.mockResolvedValue([{ id: "pl-wg", code: "WEBSITE_WHITE_GOODS" }]);
    expect(await getWebsiteCatalogPart("WEBSITE_FURNITURE")).toBeNull();
    expect(await getWebsiteCatalogPart("DEFAULT")).toBeNull();
  });
});

describe("getWebsiteOrderCatalog", () => {
  it("merges every seeded list into one catalog, with fees and special options from the first", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "pl-wg", code: "WEBSITE_WHITE_GOODS" },
      { id: "pl-fn", code: "WEBSITE_FURNITURE" },
    ]);
    const merged = await getWebsiteOrderCatalog();
    expect(merged.products.map((x) => x.code)).toEqual(["WG_DISHWASHER", "FN_SOFA"]);
    expect(merged.priceListId).toBe("pl-wg");
    expect(merged.specialOptions).toEqual([{ id: "special-pl-wg" }]);
  });

  it("still works with only white goods seeded", async () => {
    mocks.findMany.mockResolvedValue([{ id: "pl-wg", code: "WEBSITE_WHITE_GOODS" }]);
    const merged = await getWebsiteOrderCatalog();
    expect(merged.products.map((x) => x.code)).toEqual(["WG_DISHWASHER"]);
  });

  it("throws when the first (white goods) list isn't seeded — it supplies the order-level fees", async () => {
    mocks.findMany.mockResolvedValue([{ id: "pl-fn", code: "WEBSITE_FURNITURE" }]);
    await expect(getWebsiteOrderCatalog()).rejects.toThrow(/WEBSITE_WHITE_GOODS/);
  });
});
