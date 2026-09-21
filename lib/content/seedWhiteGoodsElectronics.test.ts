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

import { parsePriceListSettings } from "@/lib/products/priceListSettings";
import { seedWhiteGoodsElectronics } from "./seedWhiteGoodsElectronics";
import { roundToNearest5, WHITE_GOODS_ELECTRONICS_PRODUCTS } from "./whiteGoodsElectronics";

describe("roundToNearest5", () => {
  it("rounds to the nearest multiple of 5, halves going up", () => {
    expect(roundToNearest5(402.48)).toBe(400);
    expect(roundToNearest5(51.6)).toBe(50);
    expect(roundToNearest5(103.2)).toBe(105);
    expect(roundToNearest5(154.8)).toBe(155);
    expect(roundToNearest5(690.408)).toBe(690);
    expect(roundToNearest5(2320.968)).toBe(2320);
    expect(roundToNearest5(2.5)).toBe(5);
    expect(roundToNearest5(0)).toBe(0);
  });
});

describe("seedWhiteGoodsElectronics", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.priceListUpsert.mockResolvedValue({ id: "pl" });
    mocks.productUpsert.mockResolvedValue({ id: "p" });
    mocks.productOptionUpsert.mockResolvedValue({ id: "o" });
    mocks.priceListItemUpsert.mockResolvedValue({});
  });

  it("writes English to label + descriptionEn and Norwegian to description, so the edit-prices page shows it", async () => {
    await seedWhiteGoodsElectronics();

    const cooker = WHITE_GOODS_ELECTRONICS_PRODUCTS.find((p) => p.code === "WG_COOKER")!;
    const plug = cooker.options.find((o) => o.code === "COOKER_INSTALL_PLUG")!;
    const call = mocks.productOptionUpsert.mock.calls
      .map(([arg]) => arg)
      .find((arg) => arg.create.code === "COOKER_INSTALL_PLUG");

    expect(call.create.label).toBe(plug.labelEn);
    expect(call.create.description).toBe(plug.labelNo);
    expect(call.update.label).toBe(plug.labelEn);
    expect(call.update.description).toBe(plug.labelNo);
    expect(call.create.descriptionEn).toBe(plug.labelEn);
    expect(call.update.descriptionEn).toBe(plug.labelEn);
  });

  it("rounds option prices to the nearest 5 kr for client and subcontractor", async () => {
    await seedWhiteGoodsElectronics();

    // Options are seeded in order, one priceListItem upsert per option upsert.
    const optionCodes = mocks.productOptionUpsert.mock.calls.map(([arg]) => arg.create.code);
    const plugIndex = optionCodes.indexOf("COOKER_INSTALL_PLUG");
    const item = mocks.priceListItemUpsert.mock.calls[plugIndex][0];

    // 308.568 / 154.8 in the source data
    expect(item.create.customerPriceCents).toBe(31000);
    expect(item.create.subcontractorPriceCents).toBe(15500);
    expect(item.update.customerPriceCents).toBe(31000);
    expect(item.update.subcontractorPriceCents).toBe(15500);

    for (const [arg] of mocks.priceListItemUpsert.mock.calls) {
      expect(arg.create.customerPriceCents % 500).toBe(0);
      expect(arg.create.subcontractorPriceCents % 500).toBe(0);
    }
  });

  it("rounds delivery-type prices (incl. 2nd+ item 'xtra' prices) to the nearest 5 kr", async () => {
    await seedWhiteGoodsElectronics();

    const deliveryTypes = mocks.productUpsert.mock.calls[0][0].create.deliveryTypes as Array<
      Record<string, string>
    >;
    const firstStep = deliveryTypes.find((d) => d.code === "FIRST_STEP")!;
    const indoor = deliveryTypes.find((d) => d.code === "INDOOR")!;

    // 608.88 / 402.48 / 154.8 / 103.2
    expect(firstStep).toMatchObject({
      price: "610",
      subcontractorPrice: "400",
      xtraPrice: "155",
      xtraSubcontractorPrice: "105",
    });
    // 690.408 / 464.4 / 236.33 / 123.84
    expect(indoor).toMatchObject({
      price: "690",
      subcontractorPrice: "465",
      xtraPrice: "235",
      xtraSubcontractorPrice: "125",
    });
  });

  it("rounds the order-level extras on the price list settings to the nearest 5 kr", async () => {
    await seedWhiteGoodsElectronics();

    const description = mocks.priceListUpsert.mock.calls[0][0].update.description as string;
    const settings = parsePriceListSettings(description);

    // 608.88 / 402.48 and 516 / 258 in the source data
    expect(settings.extraPickup).toMatchObject({ price: "610", subcontractorPrice: "400" });
    expect(settings.expressDelivery).toMatchObject({ price: "515", subcontractorPrice: "260" });
  });
});
