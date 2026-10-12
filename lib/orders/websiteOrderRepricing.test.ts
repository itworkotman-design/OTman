import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getWebsiteOrderCatalog: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/content/websiteOrderCatalog", () => ({ getWebsiteOrderCatalog: mocks.getWebsiteOrderCatalog }));

import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { SizeBracketSelectionError, recomputeWebsiteOrderPricing, resolveSavedCatalogPricing } from "./websiteOrderRepricing";
import { createDefaultPriceListSettings } from "@/lib/products/priceListSettings";

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

describe("recomputeWebsiteOrderPricing — km pricing by when the order was made", () => {
  const washer = {
    ...otherFurniture,
    id: "wm",
    code: "WG_WASHING_MACHINE",
    allowModelNumber: false,
    options: [option("base", "base")],
  };
  const washerCard = { ...createEmptyProductCard(0), productId: "wm", amount: 1 };

  beforeEach(() => {
    const settings = createDefaultPriceListSettings();
    settings.kmFrom21 = { ...settings.kmFrom21, price: "10", subcontractorPrice: "5" };
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ products: [washer], specialOptions: [], priceListSettings: settings });
  });

  const kmQty = (result: Awaited<ReturnType<typeof recomputeWebsiteOrderPricing>>) =>
    result.orderExtras.find((line) => line.price > 0 && /km/i.test(line.label))?.qty ?? 0;

  it("keeps the old rule (only km above 20) for an order made before the change, so its price doesn't move", async () => {
    const result = await recomputeWebsiteOrderPricing({ ...order, drivingDistance: "30", createdAt: new Date("2026-10-01T10:00:00Z") }, [washerCard]);
    expect(kmQty(result)).toBe(10);
  });

  it("charges the whole distance for an order made after it", async () => {
    const result = await recomputeWebsiteOrderPricing({ ...order, drivingDistance: "30", createdAt: new Date("2026-10-07T10:00:00Z") }, [washerCard]);
    expect(kmQty(result)).toBe(30);
  });
});

describe("recomputeWebsiteOrderPricing — order extras set to 0", () => {
  const washer = {
    ...otherFurniture,
    id: "wm",
    code: "WG_WASHING_MACHINE",
    allowModelNumber: false,
    options: [option("base", "base")],
  };
  const washerCard = { ...createEmptyProductCard(0), productId: "wm", amount: 1 };
  const kmKey = (settings: ReturnType<typeof createDefaultPriceListSettings>) => `code:${settings.kmFrom21.code}`;

  beforeEach(() => {
    const settings = createDefaultPriceListSettings();
    settings.kmFrom21 = { ...settings.kmFrom21, price: "10", subcontractorPrice: "5" };
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ products: [washer], specialOptions: [], priceListSettings: settings });
  });

  it("applies new choices and stores them in the pricing snapshot", async () => {
    const settings = createDefaultPriceListSettings();
    const base = await recomputeWebsiteOrderPricing({ ...order, drivingDistance: "30" }, [washerCard]);
    const nulled = await recomputeWebsiteOrderPricing(
      { ...order, drivingDistance: "30", nulledOrderExtras: { customer: [kmKey(settings)], subcontractor: [] } },
      [washerCard],
    );
    expect(base.priceExVat - nulled.priceExVat).toBe(300);
    expect(nulled.pricingSnapshot).toMatchObject({ nulledOrderExtraKeysForCustomer: [kmKey(settings)], nulledOrderExtraKeysForSubcontractor: [] });
  });

  it("keeps the choices already stored on the order when none are given", async () => {
    const settings = createDefaultPriceListSettings();
    const result = await recomputeWebsiteOrderPricing(
      { ...order, drivingDistance: "30", pricingSnapshot: { nulledOrderExtraKeysForCustomer: [kmKey(settings)] } },
      [washerCard],
    );
    expect(result.pricingSnapshot).toMatchObject({ nulledOrderExtraKeysForCustomer: [kmKey(settings)] });
    expect(result.orderExtras.find((line) => /km/i.test(line.label))?.price).toBe(0);
  });
});

// Like the booking app: an order keeps the catalog prices it was saved with
// (OrderPricingSnapshot on its cards) until an admin picks "Use new price".
describe("recomputeWebsiteOrderPricing — frozen catalog prices", () => {
  const washer = (price: string) => ({
    ...otherFurniture,
    id: "wm",
    code: "WG_WASHING_MACHINE",
    allowModelNumber: false,
    allowExtraServices: true,
    options: [{ ...option("ex", "extra"), customerPrice: price, effectiveCustomerPrice: price }],
  });
  const washerCard = { ...createEmptyProductCard(0), productId: "wm", amount: 1, selectedExtraOptionIds: ["ex"] };

  async function savedAt(price: string) {
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ products: [washer(price)], specialOptions: [], priceListSettings: null });
    return recomputeWebsiteOrderPricing(order, [washerCard]);
  }

  it("stores the catalog prices it priced with on every card", async () => {
    const saved = await savedAt("100");
    expect(saved.cards[0].pricingSnapshot?.productOptions.ex).toMatchObject({ customerPrice: "100" });
  });

  it("prices with the frozen prices it's given, not today's catalog, and keeps them on the cards", async () => {
    const saved = await savedAt("100");
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ products: [washer("300")], specialOptions: [], priceListSettings: null });

    const frozen = await recomputeWebsiteOrderPricing(order, [washerCard], {
      catalogPricing: saved.cards[0].pricingSnapshot ?? null,
    });
    const current = await recomputeWebsiteOrderPricing(order, [washerCard]);

    expect(frozen.priceExVat).toBe(saved.priceExVat);
    expect(current.priceExVat - frozen.priceExVat).toBe(200);
    expect(frozen.cards[0].pricingSnapshot?.productOptions.ex).toMatchObject({ customerPrice: "100" });
    expect(current.cards[0].pricingSnapshot?.productOptions.ex).toMatchObject({ customerPrice: "300" });
  });

  it("never prices with a snapshot that came in on the submitted cards", async () => {
    const saved = await savedAt("100");
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ products: [washer("300")], specialOptions: [], priceListSettings: null });
    const result = await recomputeWebsiteOrderPricing(order, [{ ...washerCard, pricingSnapshot: saved.cards[0].pricingSnapshot }]);
    expect(result.priceExVat - saved.priceExVat).toBe(200);
  });
});

// Orders saved before cards kept their catalog prices: the prices are read
// back from the stored order lines (unit price per option), and only trusted
// when they give exactly the saved customer and partner totals.
describe("resolveSavedCatalogPricing", () => {
  const washer = (price: string, partner = "50") => ({
    ...otherFurniture,
    id: "wm",
    code: "WG_WASHING_MACHINE",
    allowModelNumber: false,
    allowExtraServices: true,
    options: [{ ...option("ex", "extra"), customerPrice: price, effectiveCustomerPrice: price, subcontractorPrice: partner }],
  });
  const washerCard = { ...createEmptyProductCard(0), productId: "wm", amount: 1, selectedExtraOptionIds: ["ex"] };

  async function savedOrder(price: string, partner = "50") {
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ products: [washer(price, partner)], specialOptions: [], priceListSettings: null });
    const saved = await recomputeWebsiteOrderPricing(order, [washerCard]);
    return {
      order: { ...order, priceExVat: saved.priceExVat, priceSubcontractor: saved.priceSubcontractor },
      items: saved.builtItems.map((item) => ({
        optionId: item.optionId,
        customerPriceCents: item.customerPriceCents,
        subcontractorPriceCents: item.subcontractorPriceCents,
      })),
    };
  }

  it("uses the catalog prices already stored on the cards", async () => {
    const stored = (await savedOrder("100")).order;
    const frozen = { productOptions: { frozen: true } } as never;
    expect(await resolveSavedCatalogPricing(stored, [{ ...washerCard, pricingSnapshot: frozen }], [])).toBe(frozen);
  });

  it("reads an older order's prices back from its stored lines when the catalog has changed since", async () => {
    const { order: stored, items } = await savedOrder("100", "40");
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ products: [washer("300", "90")], specialOptions: [], priceListSettings: null });

    const pricing = await resolveSavedCatalogPricing(stored, [washerCard], items);

    expect(pricing?.productOptions.ex).toMatchObject({ customerPrice: "100", effectiveCustomerPrice: "100", subcontractorPrice: "40" });
    const repriced = await recomputeWebsiteOrderPricing(stored, [washerCard], { catalogPricing: pricing });
    expect(repriced.priceExVat).toBe(stored.priceExVat);
    expect(repriced.priceSubcontractor).toBe(stored.priceSubcontractor);
  });

  it("gives up (null) when the stored lines can't reproduce the saved totals", async () => {
    const { order: stored, items } = await savedOrder("100");
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ products: [washer("300")], specialOptions: [], priceListSettings: null });
    expect(await resolveSavedCatalogPricing({ ...stored, priceExVat: stored.priceExVat + 7 }, [washerCard], items)).toBeNull();
  });
});

// Website prices are ex. VAT; the stored snapshot keeps the customer's total
// incl. VAT summed per line (what they pay — getOrderChargeAmountIncVatNok).
describe("recomputeWebsiteOrderPricing — the customer's total incl. VAT", () => {
  const washer = {
    ...otherFurniture,
    id: "wm",
    code: "WG_WASHING_MACHINE",
    allowModelNumber: false,
    allowExtraServices: true,
    options: [{ ...option("ex", "extra"), customerPrice: "365", effectiveCustomerPrice: "365" }],
  };
  const washerCard = { ...createEmptyProductCard(0), productId: "wm", amount: 1, selectedExtraOptionIds: ["ex"] };

  it("stores it in the pricing snapshot and returns it", async () => {
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ products: [washer], specialOptions: [], priceListSettings: null });
    const result = await recomputeWebsiteOrderPricing(order, [washerCard]);
    const perLine = result.pricingResult.breakdowns.flatMap((b) => b.lines).reduce((sum, l) => sum + Math.round(l.lineTotal * 1.25), 0);
    expect(result.customerTotals.totalIncVat).toBe(perLine);
    expect(result.pricingSnapshot.customer).toMatchObject({ totalExVat: result.priceExVat, totalIncVat: perLine });
  });
});
