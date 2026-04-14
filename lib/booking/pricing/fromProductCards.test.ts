import { describe, expect, it } from "vitest";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { createDefaultProductDeliveryTypes } from "@/lib/products/deliveryTypes";
import type {
  CatalogProduct,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

function buildProduct(): CatalogProduct {
  return {
    id: "product-1",
    code: "PROD-1",
    label: "Seng",
    active: true,
    productType: "PHYSICAL",
    allowDeliveryTypes: true,
    allowInstallOptions: true,
    allowReturnOptions: false,
    allowExtraServices: false,
    allowDemont: false,
    allowQuantity: true,
    allowPeopleCount: false,
    allowHoursInput: false,
    autoXtraPerPallet: false,
    deliveryTypes: createDefaultProductDeliveryTypes(),
    customSections: [],
    options: [
      {
        id: "install-1",
        code: "INSTALL",
        label: "Montering",
        description: "Montering",
        category: "install",
        customerPrice: "300",
        subcontractorPrice: "100",
        effectiveCustomerPrice: "300",
        active: true,
      },
    ],
  };
}

function buildCard(overrides: Partial<SavedProductCard>): SavedProductCard {
  return {
    cardId: 0,
    productId: "product-1",
    deliveryType: "",
    amount: 1,
    peopleCount: 1,
    hoursInput: 1,
    selectedInstallOptionIds: [],
    selectedExtraOptionIds: [],
    selectedReturnOptionId: null,
    demontEnabled: false,
    selectedTimeOptionIds: [],
    extraTimeHours: 0.5,
    extraPalletEnabled: false,
    extraPalletQty: 1,
    etterEnabled: false,
    etterQty: 1,
    customSectionSelections: [],
    ...overrides,
  };
}

describe("buildProductBreakdowns", () => {
  it("uses standard and XTRA indoor delivery display values", () => {
    const product = buildProduct();
    const cards = [
      buildCard({
        cardId: 1,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
      buildCard({
        cardId: 2,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
    ];

    const result = buildProductBreakdowns(cards, [product], []);

    expect(result[0]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "INDOOR",
      unitPrice: 669,
      label: "Innbæring",
    });
    expect(result[1]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "INDOOR",
      unitPrice: 229,
      label: "Innbæring (XTRA)",
    });
  });

  it("uses XTRA first-step pricing after an earlier selected product", () => {
    const product = buildProduct();
    const cards = [
      buildCard({
        cardId: 1,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
      buildCard({
        cardId: 2,
        deliveryType: DELIVERY_TYPES.FIRST_STEP,
      }),
    ];

    const result = buildProductBreakdowns(cards, [product], []);

    expect(result[1]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "FIRST_STEP",
      unitPrice: 150,
      label: "Første trinn (XTRA)",
    });
  });

  it("keeps the first selected product at full price and makes later indoor products XTRA", () => {
    const product = buildProduct();
    const cards = [
      buildCard({
        cardId: 1,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
      buildCard({
        cardId: 2,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
      buildCard({
        cardId: 3,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
    ];

    const result = buildProductBreakdowns(cards, [product], []);

    expect(result[0]?.items[0]).toMatchObject({
      kind: "deliveryType",
      unitPrice: 669,
      label: "Innbæring",
    });
    expect(result[1]?.items[0]).toMatchObject({
      kind: "deliveryType",
      unitPrice: 229,
      label: "Innbæring (XTRA)",
    });
    expect(result[2]?.items[0]).toMatchObject({
      kind: "deliveryType",
      unitPrice: 229,
      label: "Innbæring (XTRA)",
    });
  });

  it("keeps full delivery pricing on the first selected product only", () => {
    const product = buildProduct();
    const cards = [
      buildCard({
        cardId: 1,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
    ];

    const result = buildProductBreakdowns(cards, [product], []);

    expect(result[0]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "INDOOR",
      unitPrice: 669,
      label: "Innbæring",
    });
  });

  it("ignores earlier empty cards when deciding XTRA pricing", () => {
    const product = buildProduct();
    const cards = [
      buildCard({
        cardId: 1,
        productId: null,
      }),
      buildCard({
        cardId: 2,
        deliveryType: DELIVERY_TYPES.FIRST_STEP,
      }),
    ];

    const result = buildProductBreakdowns(cards, [product], []);

    expect(result[0]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "FIRST_STEP",
      unitPrice: 590,
      label: "Første trinn",
    });
  });
});
