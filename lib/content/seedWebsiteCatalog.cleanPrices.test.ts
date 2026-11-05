import { beforeEach, describe, expect, it, vi } from "vitest";

// Every customer price a website seed writes — or keeps from the database on
// a reseed (staff-priced options, preserved catalogs) — ends in 0 incl. VAT
// (a multiple of 8 kr ex. VAT, websiteCleanPrice.ts), so a reseed leaves the
// catalog as clean as scripts/clean-website-prices.ts would. Exact-priced
// options (exactCustomerPrice, e.g. the pallet pickup's deliberate 100 kr) are
// the one exception, and partner prices are never touched.

const mocks = vi.hoisted(() => ({
  priceListUpsert: vi.fn(),
  productUpsert: vi.fn(),
  productFindUnique: vi.fn(),
  productOptionUpsert: vi.fn(),
  priceListItemUpsert: vi.fn(),
  priceListItemFindUnique: vi.fn(),
  configUpsert: vi.fn(),
  configFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    priceList: { upsert: mocks.priceListUpsert },
    product: { upsert: mocks.productUpsert, findUnique: mocks.productFindUnique },
    productOption: { upsert: mocks.productOptionUpsert, findMany: async () => [], update: async () => ({}) },
    priceListItem: { upsert: mocks.priceListItemUpsert, findUnique: mocks.priceListItemFindUnique },
    priceListProductConfig: { upsert: mocks.configUpsert, findUnique: mocks.configFindUnique },
    priceListProduct: { upsert: async () => ({}) },
  },
}));

import { seedWebsiteCatalog } from "./seedWebsiteCatalog";
import { WHITE_GOODS_ELECTRONICS_PRODUCTS, type WhiteGoodsProductSeed } from "./whiteGoodsElectronics";
import { FURNITURE_PRODUCTS } from "./furnitureCatalog";
import { PARCEL_PALLET_PRODUCTS } from "./parcelPalletCatalog";
import { parsePriceListSettings } from "@/lib/products/priceListSettings";
import { cleanWebsitePriceListSettings } from "@/lib/booking/pricing/websiteCleanPrice";

const product = {
  code: "FN_TEST",
  nameEn: "Test",
  nameNo: "Test",
  sortOrder: 1,
  deliveryTypes: {
    firstStep: { customerPrice: 100, subcontractorPrice: 50, xtraPrice: 10, xtraSubcontractorPrice: 5 },
    indoor: { customerPrice: 120, subcontractorPrice: 60, xtraPrice: 12, xtraSubcontractorPrice: 6 },
    installOnlyEnabled: true,
  },
  options: [
    { code: "UNPACKING", category: "extra", labelEn: "Unpacking", labelNo: "Utpakking", customerPrice: 100, subcontractorPrice: 50 },
    { code: "OF_LG_FIRST_STEP", category: "size_large_delivery", labelEn: "Large", labelNo: "Stor", customerPrice: 0, subcontractorPrice: 0, staffPriced: true },
    { code: "PALLET_PICKUP", category: "extra", labelEn: "Pallet", labelNo: "Pall", customerPrice: 100, subcontractorPrice: 60, exactCustomerPrice: true },
  ],
} as unknown as WhiteGoodsProductSeed;

const isClean = (exVat: number) => Number.isInteger(exVat / 8);

function itemCallFor(optionCode: string) {
  const index = mocks.productOptionUpsert.mock.calls.findIndex(([arg]) => arg.create.code === optionCode);
  return mocks.priceListItemUpsert.mock.calls[index][0];
}

// Stored rows by option code, for the findUnique the seed does on a kept price.
function storedItems(byOption: Record<string, { customerPriceCents: number; subcontractorPriceCents: number }>) {
  mocks.productOptionUpsert.mockImplementation(async (arg: { create: { code: string } }) => ({ id: arg.create.code }));
  mocks.priceListItemFindUnique.mockImplementation(
    async (arg: { where: { priceListId_productOptionId: { productOptionId: string } } }) =>
      byOption[arg.where.priceListId_productOptionId.productOptionId] ?? null,
  );
}

describe("seedWebsiteCatalog — clean customer prices", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.priceListUpsert.mockResolvedValue({ id: "pl" });
    mocks.productUpsert.mockResolvedValue({ id: "p" });
    mocks.productFindUnique.mockResolvedValue(null);
    mocks.productOptionUpsert.mockResolvedValue({ id: "o" });
    mocks.priceListItemUpsert.mockResolvedValue({});
    mocks.priceListItemFindUnique.mockResolvedValue(null);
    mocks.configUpsert.mockResolvedValue({});
    mocks.configFindUnique.mockResolvedValue(null);
  });

  it("cleans a staff-priced option's stored price instead of keeping it as-is", async () => {
    storedItems({ OF_LG_FIRST_STEP: { customerPriceCents: 60900, subcontractorPriceCents: 40000 } });

    await seedWebsiteCatalog({ priceListCode: "WEBSITE_FURNITURE", priceListName: "Furniture", products: [product] });

    // 609 → 616 (770 incl.); the partner price stays.
    expect(itemCallFor("OF_LG_FIRST_STEP").update).toEqual({ customerPriceCents: 61600 });
  });

  it("leaves a staff-priced option that's already clean (or still at the 0 kr placeholder) alone", async () => {
    storedItems({ OF_LG_FIRST_STEP: { customerPriceCents: 61600, subcontractorPriceCents: 40000 } });
    await seedWebsiteCatalog({ priceListCode: "WEBSITE_FURNITURE", priceListName: "Furniture", products: [product] });
    expect(itemCallFor("OF_LG_FIRST_STEP").update).toEqual({});

    mocks.priceListItemUpsert.mockClear();
    mocks.productOptionUpsert.mockClear();
    storedItems({ OF_LG_FIRST_STEP: { customerPriceCents: 0, subcontractorPriceCents: 0 } });
    await seedWebsiteCatalog({ priceListCode: "WEBSITE_FURNITURE", priceListName: "Furniture", products: [product] });
    expect(itemCallFor("OF_LG_FIRST_STEP").update).toEqual({});
  });

  it("cleans the stored prices a preserving catalog keeps", async () => {
    storedItems({ UNPACKING: { customerPriceCents: 12500, subcontractorPriceCents: 6000 } });

    await seedWebsiteCatalog({
      priceListCode: "WEBSITE_PARCEL_PALLET",
      priceListName: "Parcel",
      products: [product],
      preservePricesOnReseed: true,
    });

    expect(itemCallFor("UNPACKING").update).toEqual({ customerPriceCents: 12800 });
  });

  it("keeps an exact-priced option exact, whether seeded or stored", async () => {
    storedItems({ PALLET_PICKUP: { customerPriceCents: 10000, subcontractorPriceCents: 6000 } });

    await seedWebsiteCatalog({
      priceListCode: "WEBSITE_PARCEL_PALLET",
      priceListName: "Parcel",
      products: [product],
      preservePricesOnReseed: true,
    });

    const call = itemCallFor("PALLET_PICKUP");
    expect(call.create.customerPriceCents).toBe(10000);
    expect(call.update).toEqual({});
  });

  it("cleans kept delivery prices on the product and on the list's own copy (install-only rounded down)", async () => {
    const stored = [
      { key: "FIRST_STEP", enabled: true, price: "610", subcontractorPrice: "400", xtraPrice: "150", xtraSubcontractorPrice: "90" },
      { key: "INDOOR", enabled: true, price: "800", subcontractorPrice: "500", xtraPrice: "240", xtraSubcontractorPrice: "150" },
      { key: "INSTALL_ONLY", enabled: true, price: "609", subcontractorPrice: "400", xtraPrice: "0", xtraSubcontractorPrice: "0" },
    ];
    mocks.productFindUnique.mockResolvedValue({ deliveryTypes: stored });
    mocks.configFindUnique.mockResolvedValue({ deliveryTypes: stored });

    await seedWebsiteCatalog({
      priceListCode: "WEBSITE_PARCEL_PALLET",
      priceListName: "Parcel",
      products: [product],
      preservePricesOnReseed: true,
    });

    const byKey = (types: { key: string }[]) => Object.fromEntries(types.map((t) => [t.key, t]));
    for (const types of [
      mocks.productUpsert.mock.calls[0][0].update.deliveryTypes,
      mocks.configUpsert.mock.calls[0][0].update.deliveryTypes,
    ]) {
      const entries = byKey(types);
      expect(entries.FIRST_STEP).toMatchObject({ price: "616", xtraPrice: "152", subcontractorPrice: "400" });
      expect(entries.INDOOR).toMatchObject({ price: "800", xtraPrice: "240" });
      expect(entries.INSTALL_ONLY).toMatchObject({ price: "608", xtraPrice: "0" });
    }
  });

  it.each([
    ["white goods", "WEBSITE_WHITE_GOODS", WHITE_GOODS_ELECTRONICS_PRODUCTS],
    ["furniture", "WEBSITE_FURNITURE", FURNITURE_PRODUCTS],
    ["parcel/pallet", "WEBSITE_PARCEL_PALLET", PARCEL_PALLET_PRODUCTS],
  ])("writes only clean customer prices for the real %s catalog", async (_name, priceListCode, products) => {
    mocks.productOptionUpsert.mockImplementation(async (arg: { create: { code: string } }) => ({ id: arg.create.code }));

    await seedWebsiteCatalog({ priceListCode, priceListName: priceListCode, products });

    const exact = new Set(products.flatMap((p) => p.options.filter((o) => o.exactCustomerPrice).map((o) => o.code)));
    const unclean: string[] = [];
    for (const [arg] of mocks.priceListItemUpsert.mock.calls) {
      const code = arg.where.priceListId_productOptionId.productOptionId as string;
      if (exact.has(code)) continue;
      for (const cents of [arg.create.customerPriceCents, arg.update.customerPriceCents]) {
        if (cents !== undefined && !isClean(cents / 100)) unclean.push(`${code}: ${cents / 100}`);
      }
    }
    for (const [arg] of mocks.productUpsert.mock.calls) {
      for (const entry of arg.create.deliveryTypes as { key: string; price: string; xtraPrice: string }[]) {
        for (const field of ["price", "xtraPrice"] as const) {
          if (!isClean(Number(entry[field]))) unclean.push(`${arg.create.code}.${entry.key}.${field}: ${entry[field]}`);
        }
      }
    }
    const settings = parsePriceListSettings(mocks.priceListUpsert.mock.calls[0][0].create.description);
    // Every fee the cleanup script cleans, deviation fees included (per-km rates aren't).
    const cleanedSettings = cleanWebsitePriceListSettings(settings);
    for (const key of ["extraPickup", "expressDelivery", "xtraPallet", "extraWork", "addToOrder", "floorSurcharge"] as const) {
      if (cleanedSettings[key].price !== settings[key].price) unclean.push(`fee ${key}: ${settings[key].price}`);
    }
    for (const [key, fee] of Object.entries(settings.deviations)) {
      if (cleanedSettings.deviations[key].price !== fee.price) unclean.push(`deviation ${key}: ${fee.price}`);
    }
    expect(unclean).toEqual([]);
  });
});
