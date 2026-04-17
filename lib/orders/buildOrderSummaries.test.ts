import { describe, expect, it } from "vitest";

import type {
  CatalogProduct,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";

import { buildOrderSummaries } from "./buildOrderSummaries";

function createProduct(overrides: Partial<CatalogProduct>): CatalogProduct {
  return {
    id: "product-1",
    code: "PRODUCT_1",
    label: "Product",
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
    options: [],
    ...overrides,
  };
}

function createCard(overrides: Partial<SavedProductCard>): SavedProductCard {
  return {
    cardId: 1,
    productId: "product-1",
    modelNumber: "",
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

describe("buildOrderSummaries", () => {
  it("collapses repeated product and delivery type labels into counted summaries", () => {
    const product = createProduct({
      label: "Washer",
      allowDeliveryTypes: true,
      deliveryTypes: [
        {
          key: DELIVERY_TYPES.INDOOR,
          code: "INDOOR",
          label: "Indoor carry",
          price: "669",
          xtraPrice: "229",
        },
      ],
    });

    const result = buildOrderSummaries(
      [
        createCard({
          amount: 4,
          deliveryType: DELIVERY_TYPES.INDOOR,
        }),
      ],
      [product],
      [],
    );

    expect(result.productsSummary).toBe("Washer x4");
    expect(result.deliveryTypeSummary).toBe("Indoor carry x4");
    expect(result.servicesSummary).toBe("");
  });

  it("preserves first-seen order while aggregating duplicate labels across cards", () => {
    const firstProduct = createProduct({
      id: "product-1",
      code: "WASHER",
      label: "Washer",
      allowDeliveryTypes: true,
      deliveryTypes: [
        {
          key: DELIVERY_TYPES.INDOOR,
          code: "INDOOR",
          label: "Indoor carry",
          price: "669",
          xtraPrice: "229",
        },
      ],
    });
    const secondProduct = createProduct({
      id: "product-2",
      code: "DRYER",
      label: "Dryer",
      allowDeliveryTypes: true,
      deliveryTypes: [
        {
          key: DELIVERY_TYPES.FIRST_STEP,
          code: "FIRST_STEP",
          label: "First step",
          price: "590",
          xtraPrice: "150",
        },
      ],
    });

    const result = buildOrderSummaries(
      [
        createCard({
          cardId: 1,
          productId: "product-1",
          amount: 2,
          deliveryType: DELIVERY_TYPES.INDOOR,
        }),
        createCard({
          cardId: 2,
          productId: "product-2",
          amount: 1,
          deliveryType: DELIVERY_TYPES.FIRST_STEP,
        }),
        createCard({
          cardId: 3,
          productId: "product-1",
          amount: 1,
          deliveryType: DELIVERY_TYPES.INDOOR,
        }),
      ],
      [firstProduct, secondProduct],
      [],
    );

    expect(result.productsSummary).toBe("Washer x3, Dryer");
    expect(result.deliveryTypeSummary).toBe("Indoor carry x3, First step");
  });
});
