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

import { seedWebsiteCatalog } from "./seedWebsiteCatalog";
import type { WhiteGoodsProductSeed } from "./whiteGoodsElectronics";

const product = {
  code: "FN_TEST",
  nameEn: "Test",
  nameNo: "Test",
  sortOrder: 1,
  deliveryTypes: {
    firstStep: { customerPrice: 100, subcontractorPrice: 50, xtraPrice: 10, xtraSubcontractorPrice: 5 },
    indoor: { customerPrice: 120, subcontractorPrice: 60, xtraPrice: 12, xtraSubcontractorPrice: 6 },
    installOnlyEnabled: false,
  },
  options: [
    { code: "UNPACKING", category: "extra", labelEn: "Unpacking", labelNo: "Utpakking", customerPrice: 100, subcontractorPrice: 50 },
    {
      code: "OF_VOL_1",
      category: "size_volume",
      labelEn: "Up to 0.25 m³",
      labelNo: "Opptil 0,25 m³",
      customerPrice: 0,
      subcontractorPrice: 0,
      staffPriced: true,
    },
  ],
} as unknown as WhiteGoodsProductSeed;

function priceItemUpdateFor(optionCode: string) {
  const optionIndex = mocks.productOptionUpsert.mock.calls.findIndex(([arg]) => arg.create.code === optionCode);
  return mocks.priceListItemUpsert.mock.calls[optionIndex][0];
}

describe("seedWebsiteCatalog — staff-priced options", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.priceListUpsert.mockResolvedValue({ id: "pl" });
    mocks.productUpsert.mockResolvedValue({ id: "p" });
    mocks.productOptionUpsert.mockResolvedValue({ id: "o" });
    mocks.priceListItemUpsert.mockResolvedValue({});
  });

  it("refreshes ordinary option prices from the seed on reseed (spreadsheet-sourced catalogs)", async () => {
    await seedWebsiteCatalog({ priceListCode: "WEBSITE_FURNITURE", priceListName: "Furniture", products: [product] });

    expect(priceItemUpdateFor("UNPACKING").update).toEqual({ customerPriceCents: 10000, subcontractorPriceCents: 5000 });
  });

  it("never overwrites a staffPriced option's price on reseed, but still creates it with the placeholder", async () => {
    await seedWebsiteCatalog({ priceListCode: "WEBSITE_FURNITURE", priceListName: "Furniture", products: [product] });

    const call = priceItemUpdateFor("OF_VOL_1");
    expect(call.update).toEqual({});
    expect(call.create).toMatchObject({ customerPriceCents: 0, subcontractorPriceCents: 0 });
  });
});
