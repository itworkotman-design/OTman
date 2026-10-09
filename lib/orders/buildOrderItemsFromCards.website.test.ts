import { describe, expect, it } from "vitest";
import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { buildOrderItemsFromCards } from "./buildOrderItemsFromCards";

// Website catalog shape: delivery types priced on the product, and "return old
// product for recycling" as the product's own return option (not one of the
// dashboard's global RETURNSTORE/RETURNREC special options).
const deliveryType = (key: string, price: string) => ({
  key: key as CatalogProduct["deliveryTypes"][number]["key"],
  enabled: true,
  code: key,
  label: key === DELIVERY_TYPES.INDOOR ? "Delivery with carry-in" : "Doorstep",
  price,
  subcontractorPrice: "100",
  xtraPrice: "235",
  xtraSubcontractorPrice: "50",
  allowInstallOptions: true,
  allowExtraServices: true,
  allowReturnOptions: true,
  allowModelNumber: false,
});

const washer: CatalogProduct = {
  id: "p-wm",
  code: "WG_WASHING_MACHINE",
  label: "Washing machine",
  active: true,
  productType: "PHYSICAL",
  allowDeliveryTypes: true,
  allowInstallOptions: true,
  allowReturnOptions: true,
  allowExtraServices: true,
  allowDemont: false,
  allowQuantity: true,
  allowPeopleCount: false,
  allowHoursInput: false,
  allowModelNumber: false,
  autoXtraPerPallet: false,
  deliveryTypes: [deliveryType(DELIVERY_TYPES.FIRST_STEP, "450"), deliveryType(DELIVERY_TYPES.INDOOR, "690")],
  customSections: [],
  options: [
    {
      id: "ret-1",
      code: "RETURN_RECYCLING",
      label: "Retur av gammel vare til gjenvinning",
      description: "",
      category: "return",
      customerPrice: "260",
      subcontractorPrice: "120",
      effectiveCustomerPrice: "260",
      active: true,
    },
  ],
};

const card = (overrides: Partial<SavedProductCard> = {}): SavedProductCard => ({
  ...createEmptyProductCard(0),
  productId: "p-wm",
  amount: 1,
  deliveryType: DELIVERY_TYPES.INDOOR,
  ...overrides,
});

describe("buildOrderItemsFromCards — website catalog", () => {
  it("prices the product's own return option (the engine charges it, so the line must too)", () => {
    const items = buildOrderItemsFromCards([card({ selectedReturnOptionId: "ret-1" })], [washer], []);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "RETURN_OPTION",
          optionId: "ret-1",
          optionCode: "RETURN_RECYCLING",
          optionLabel: "Retur av gammel vare til gjenvinning",
          customerPriceCents: 26000,
          subcontractorPriceCents: 12000,
        }),
      ]),
    );
  });

  it("charges the delivery type normally within 100 km", () => {
    const items = buildOrderItemsFromCards([card()], [washer], []);
    expect(items).toEqual(
      expect.arrayContaining([expect.objectContaining({ itemType: "EXTRA_OPTION", optionLabel: "Delivery with carry-in", customerPriceCents: 69000 })]),
    );
  });

  it("keeps the delivery line at 0 kr over 100 km, where the per-km charge replaces it (same rule as the engine)", () => {
    const items = buildOrderItemsFromCards([card()], [washer], [], { zeroBaseDeliveryPricesOver100Km: true });
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "EXTRA_OPTION",
          optionLabel: "Delivery with carry-in",
          customerPriceCents: 0,
          subcontractorPriceCents: 0,
        }),
      ]),
    );
  });
});

describe("buildOrderItemsFromCards — extra-rate delivery line", () => {
  // The second card's delivery is charged at the extra-unit rate; the
  // calculator calls that line XTRA, and the stored line must be keyed the
  // same so "Set to 0" on it nulls the stored line too.
  it("stores an extra-rate delivery line under the XTRA code, so a line set to 0 is 0 when stored", () => {
    const cards = [card({ cardId: 0 }), card({ cardId: 1, nulledLineKeysForCustomer: ["code:XTRA"] })];
    const delivery = buildOrderItemsFromCards(cards, [washer], []).filter(
      (item) => (item.rawData as { source?: string } | null)?.source === "delivery_type_price",
    );

    expect(delivery.map((item) => [item.cardId, item.optionCode, item.customerPriceCents])).toEqual([
      [0, DELIVERY_TYPES.INDOOR, 69000],
      [1, "XTRA", 0],
    ]);
  });
});
