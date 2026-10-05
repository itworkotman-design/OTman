import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  priceListUpsert: vi.fn(),
  productUpsert: vi.fn(),
  productOptionUpsert: vi.fn(),
  priceListItemUpsert: vi.fn(),
  priceListProductUpsert: vi.fn(),
  productFindUnique: vi.fn(),
  priceListItemFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    priceList: { upsert: mocks.priceListUpsert },
    product: { upsert: mocks.productUpsert, findUnique: mocks.productFindUnique },
    productOption: { upsert: mocks.productOptionUpsert, findMany: async () => [], update: async () => ({}) },
    priceListItem: { upsert: mocks.priceListItemUpsert, findUnique: mocks.priceListItemFindUnique },
    priceListProduct: { upsert: mocks.priceListProductUpsert },
  },
}));

import { parsePriceListSettings } from "@/lib/products/priceListSettings";
import { seedParcelPalletCatalog } from "./seedParcelPalletCatalog";
import { PARCEL_PALLET_PRICE_LIST_CODE, PARCEL_PALLET_PRODUCTS } from "./parcelPalletCatalog";

describe("seedParcelPalletCatalog", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.priceListUpsert.mockResolvedValue({ id: "pl-parcel-pallet" });
    mocks.productUpsert.mockResolvedValue({ id: "p" });
    mocks.productOptionUpsert.mockResolvedValue({ id: "o" });
    mocks.priceListItemUpsert.mockResolvedValue({});
    mocks.priceListProductUpsert.mockResolvedValue({});
    mocks.productFindUnique.mockResolvedValue(null);
    mocks.priceListItemFindUnique.mockResolvedValue(null);
  });

  it("marks the price list delivery-only", async () => {
    await seedParcelPalletCatalog();

    const call = mocks.priceListUpsert.mock.calls[0][0];
    expect(parsePriceListSettings(call.create.description).deliveryOnly).toBe(true);
  });

  it("links every option-less product to the price list directly, since it has no PriceListItem to do it (envelope, bag)", async () => {
    await seedParcelPalletCatalog();

    const optionLessProductCount = PARCEL_PALLET_PRODUCTS.filter((p) => p.options.length === 0).length;
    expect(mocks.priceListProductUpsert).toHaveBeenCalledTimes(optionLessProductCount);
    for (const [arg] of mocks.priceListProductUpsert.mock.calls) {
      expect(arg.where.priceListId_productId).toEqual({ priceListId: "pl-parcel-pallet", productId: "p" });
      expect(arg.update).toEqual({});
      expect(arg.create).toEqual({ priceListId: "pl-parcel-pallet", productId: "p" });
    }
  });

  it("creates the WEBSITE_PARCEL_PALLET price list", async () => {
    const result = await seedParcelPalletCatalog();

    const call = mocks.priceListUpsert.mock.calls[0][0];
    expect(call.where.code).toBe(PARCEL_PALLET_PRICE_LIST_CODE);
    expect(result.priceListId).toBe("pl-parcel-pallet");
  });

  it("seeds every product (delivery-only, no install options)", async () => {
    const result = await seedParcelPalletCatalog();

    expect(result.productsUpserted).toBe(PARCEL_PALLET_PRODUCTS.length);
    const codes = mocks.productUpsert.mock.calls.map(([arg]) => arg.create.code);
    expect(codes).toEqual(PARCEL_PALLET_PRODUCTS.map((p) => p.code));
  });

  it("offers envelope -> bag -> boxes -> half-pallet -> pallet, in that display order, with no parcel or perishables", () => {
    const sorted = [...PARCEL_PALLET_PRODUCTS].sort((a, b) => a.sortOrder - b.sortOrder);

    expect(sorted.map((p) => p.code)).toEqual([
      "PKG_KONVOLUTT",
      "PKG_POSE",
      "PKG_ESKER",
      "PKG_HALVPALL",
      "PKG_PALL",
    ]);
    expect(new Set(sorted.map((p) => p.sortOrder)).size).toBe(sorted.length);
  });

  it("fills prices still at the 0 kr placeholder on reseed, but keeps prices staff entered", async () => {
    const zero = { price: "0", subcontractorPrice: "0", xtraPrice: "0", xtraSubcontractorPrice: "0" };
    mocks.productFindUnique.mockImplementation(async ({ where }: { where: { code: string } }) =>
      where.code === "PKG_PALL"
        ? { deliveryTypes: [{ key: "FIRST_STEP", enabled: true, ...zero }, { key: "INDOOR", enabled: true, ...zero }] }
        : { deliveryTypes: [{ key: "FIRST_STEP", enabled: true, price: "650", subcontractorPrice: "420", xtraPrice: "160", xtraSubcontractorPrice: "100" }] },
    );
    await seedParcelPalletCatalog();

    const update = (code: string) => mocks.productUpsert.mock.calls.find(([arg]) => arg.create.code === code)![0].update;
    expect(update("PKG_PALL").deliveryTypes.find((t: { key: string }) => t.key === "FIRST_STEP")).toMatchObject({ price: "775" });
    expect(update("PKG_PALL").deliveryTypes.find((t: { key: string }) => t.key === "INDOOR").enabled).toBe(false);
    expect(update("PKG_ESKER").deliveryTypes.find((t: { key: string }) => t.key === "FIRST_STEP")).toMatchObject({ price: "650" });
  });

  it("fills an option price still at 0 kr, but never overwrites one staff entered", async () => {
    mocks.priceListItemFindUnique
      .mockResolvedValueOnce({ customerPriceCents: 0, subcontractorPriceCents: 0 })
      .mockResolvedValue({ customerPriceCents: 15000, subcontractorPriceCents: 9000 });
    await seedParcelPalletCatalog();

    const updates = mocks.priceListItemUpsert.mock.calls.map(([arg]) => arg.update);
    expect(updates[0]).toEqual({ customerPriceCents: 10500, subcontractorPriceCents: 5000 });
    expect(updates.slice(1).every((u) => JSON.stringify(u) === "{}")).toBe(true);
  });

  it("has no PriceListItem rows for the delivery-only products with no options (envelope, bag) — confirming deliveryTypes above is the actual price-bearing field for those, not a moot check", async () => {
    await seedParcelPalletCatalog();

    // Boxes/half-pallet/pallet's unpacking + pallet-pickup add-ons DO get
    // PriceListItem rows, one per option across those products.
    const optionCount = PARCEL_PALLET_PRODUCTS.reduce((sum, p) => sum + p.options.length, 0);
    expect(mocks.priceListItemUpsert).toHaveBeenCalledTimes(optionCount);
  });
});
