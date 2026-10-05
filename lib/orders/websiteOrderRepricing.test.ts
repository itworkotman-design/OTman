import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getWebsiteOrderCatalog: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/content/websiteOrderCatalog", () => ({ getWebsiteOrderCatalog: mocks.getWebsiteOrderCatalog }));

import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { SizeBracketSelectionError, recomputeWebsiteOrderPricing } from "./websiteOrderRepricing";

const option = (id: string, category: string) => ({
  id,
  code: id.toUpperCase(),
  label: id,
  description: id,
  category,
  customerPrice: "100",
  subcontractorPrice: "50",
  effectiveCustomerPrice: "100",
  active: true,
});

// Other furniture: priced by size, so it needs a volume + weight bracket and a name.
const otherFurniture = {
  id: "of",
  code: "FN_OTHER_FURNITURE",
  label: "Other furniture",
  active: true,
  productType: "PHYSICAL",
  allowDeliveryTypes: false,
  allowInstallOptions: false,
  allowReturnOptions: false,
  allowExtraServices: false,
  allowDemont: false,
  allowQuantity: true,
  allowPeopleCount: false,
  allowHoursInput: false,
  allowModelNumber: true,
  autoXtraPerPallet: false,
  deliveryTypes: [],
  customSections: [],
  options: [option("vol-1", "size_volume"), option("wt-1", "size_weight")],
};

const order = {
  drivingDistance: "21",
  expressDelivery: false,
  floorNo: "0",
  lift: "yes",
  extraPickupAddress: [],
  websiteBookingDetails: null,
  rabatt: null,
  leggTil: null,
  subcontractorMinus: null,
  subcontractorPlus: null,
};

const incompleteCard = { ...createEmptyProductCard(0), productId: "of", amount: 1, modelNumber: "" };

describe("recomputeWebsiteOrderPricing", () => {
  beforeEach(() => {
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ products: [otherFurniture], specialOptions: [], priceListSettings: null });
  });

  it("refuses an Other-furniture card without its size (the customer's edit link)", async () => {
    await expect(recomputeWebsiteOrderPricing(order, [incompleteCard])).rejects.toBeInstanceOf(SizeBracketSelectionError);
  });

  it("prices it anyway for an admin save (allowIncomplete)", async () => {
    const result = await recomputeWebsiteOrderPricing(order, [incompleteCard], { allowIncomplete: true });
    expect(result.cards).toHaveLength(1);
  });

  it("prices an order with no products at all for an admin save", async () => {
    const result = await recomputeWebsiteOrderPricing(order, [], { allowIncomplete: true });
    expect(result.builtItems).toEqual([]);
  });
});

describe("recomputeWebsiteOrderPricing — admin handling fields", () => {
  const washer = {
    ...otherFurniture,
    id: "wm",
    code: "WG_WASHING_MACHINE",
    allowModelNumber: false,
    options: [option("base", "base")],
  };

  beforeEach(() => {
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ products: [washer], specialOptions: [], priceListSettings: null });
  });

  const washerCard = { ...createEmptyProductCard(0), productId: "wm", amount: 1 };

  it("charges the order's deviation and keeps a custom one's price/description in the snapshot", async () => {
    const base = await recomputeWebsiteOrderPricing(order, [washerCard]);
    const custom = await recomputeWebsiteOrderPricing(
      {
        ...order,
        deviation: "Custom",
        customDeviation: { price: 400, subcontractorPrice: 200, description: "Ventetid" },
      },
      [washerCard],
    );
    expect(custom.priceExVat - base.priceExVat).toBe(400);
    expect(custom.orderExtras).toEqual(expect.arrayContaining([{ label: "Ventetid", price: 400, qty: 1 }]));
    expect(custom.pricingSnapshot).toMatchObject({
      customDeviationPrice: 400,
      customDeviationSubcontractorPrice: 200,
      customDeviationDescription: "Ventetid",
    });
  });

  it("keeps a custom deviation already stored on the order (e.g. the customer's own edit link re-pricing)", async () => {
    const result = await recomputeWebsiteOrderPricing(
      {
        ...order,
        deviation: "Custom",
        pricingSnapshot: { customDeviationPrice: 250, customDeviationSubcontractorPrice: 100, customDeviationDescription: "Ekstra bæring" },
      },
      [washerCard],
    );
    expect(result.orderExtras).toEqual(expect.arrayContaining([{ label: "Ekstra bæring", price: 250, qty: 1 }]));
  });

  it("applies the order's discount and extra", async () => {
    const base = await recomputeWebsiteOrderPricing(order, [washerCard]);
    const adjusted = await recomputeWebsiteOrderPricing({ ...order, rabatt: "100", leggTil: "30" }, [washerCard]);
    expect(adjusted.priceExVat - base.priceExVat).toBe(-70);
  });
});
