import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  priceListUpsert: vi.fn(),
  productUpsert: vi.fn(),
  productOptionUpsert: vi.fn(),
  priceListItemUpsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    priceList: { upsert: mocks.priceListUpsert },
    product: { upsert: mocks.productUpsert },
    productOption: { upsert: mocks.productOptionUpsert },
    priceListItem: { upsert: mocks.priceListItemUpsert },
  },
}));

import { seedParcelPalletCatalog } from "./seedParcelPalletCatalog";
import { PARCEL_PALLET_PRICE_LIST_CODE, PARCEL_PALLET_PRODUCTS } from "./parcelPalletCatalog";

describe("seedParcelPalletCatalog", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.priceListUpsert.mockResolvedValue({ id: "pl-parcel-pallet" });
    mocks.productUpsert.mockResolvedValue({ id: "p" });
    mocks.productOptionUpsert.mockResolvedValue({ id: "o" });
    mocks.priceListItemUpsert.mockResolvedValue({});
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

  it("never overwrites a product's deliveryTypes (where its price actually lives — these delivery-only products have no options/PriceListItem rows) on reseed", async () => {
    await seedParcelPalletCatalog();

    expect(mocks.productUpsert.mock.calls.length).toBeGreaterThan(0);
    for (const [arg] of mocks.productUpsert.mock.calls) {
      expect(arg.update.deliveryTypes).toBeUndefined();
      // Everything else stays in sync from code on every reseed, though.
      expect(arg.update.name).toBeDefined();
    }
  });

  it("has no PriceListItem rows to protect for these delivery-only products — confirming deliveryTypes above is the actual price-bearing field, not a moot check", async () => {
    await seedParcelPalletCatalog();

    expect(mocks.priceListItemUpsert).not.toHaveBeenCalled();
  });
});
