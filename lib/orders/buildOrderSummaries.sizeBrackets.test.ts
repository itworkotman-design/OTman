import { describe, expect, it } from "vitest";
import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { createDefaultProductDeliveryTypes } from "@/lib/products/deliveryTypes";
import { buildOrderSummaries } from "./buildOrderSummaries";

function option(id: string, code: string, category: string, description: string) {
  return {
    id,
    code,
    label: code,
    description,
    category,
    customerPrice: "0",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "0",
    active: true,
  };
}

function makeProduct(allowExtraServices: boolean): CatalogProduct {
  return {
    id: "other-furniture",
    code: "FN_OTHER_FURNITURE",
    label: "Other furniture",
    active: true,
    productType: "PHYSICAL",
    allowDeliveryTypes: true,
    allowInstallOptions: false,
    allowReturnOptions: false,
    allowExtraServices,
    allowDemont: false,
    allowQuantity: true,
    allowPeopleCount: false,
    allowHoursInput: false,
    allowModelNumber: false,
    autoXtraPerPallet: false,
    deliveryTypes: createDefaultProductDeliveryTypes(),
    customSections: [],
    options: [
      option("vol", "OF_VOL_2", "size_volume", "Up to 1 m³"),
      option("wt", "OF_WT_1", "size_weight", "Up to 25 kg"),
    ],
  };
}

const card: SavedProductCard = {
  cardId: 0,
  productId: "other-furniture",
  modelNumber: "",
  deliveryType: DELIVERY_TYPES.FIRST_STEP,
  amount: 1,
  peopleCount: 1,
  hoursInput: 1,
  selectedInstallOptionIds: [],
  selectedExtraOptionIds: ["vol", "wt"],
  selectedReturnOptionId: null,
  demontEnabled: false,
  selectedTimeOptionIds: [],
  extraTimeHours: 0.5,
  extraPalletEnabled: false,
  extraPalletQty: 1,
  etterEnabled: false,
  etterQty: 1,
  customSectionSelections: [],
};

describe("buildOrderSummaries — size brackets", () => {
  it("lists the chosen volume and weight so staff and drivers see them, even when extras are off", () => {
    const { servicesSummary } = buildOrderSummaries([card], [makeProduct(false)], []);

    expect(servicesSummary).toContain("Up to 1 m³");
    expect(servicesSummary).toContain("Up to 25 kg");
  });

  it("lists each bracket exactly once when extras are on", () => {
    const { servicesSummary } = buildOrderSummaries([card], [makeProduct(true)], []);

    expect(servicesSummary.match(/Up to 1 m³/g)).toHaveLength(1);
    expect(servicesSummary.match(/Up to 25 kg/g)).toHaveLength(1);
  });
});

describe("buildOrderSummaries — dimensions", () => {
  it("lists the customer's width x height x length and the calculated volume", () => {
    const withDims: SavedProductCard = { ...card, sizeDimensionsCm: { widthCm: 100, heightCm: 50, lengthCm: 50 } };

    const { servicesSummary } = buildOrderSummaries([withDims], [makeProduct(false)], []);

    expect(servicesSummary).toContain("100 × 50 × 50 cm (0.25 m³)");
  });

  it("omits the dimensions when they are incomplete", () => {
    const partial: SavedProductCard = { ...card, sizeDimensionsCm: { widthCm: 100 } };

    const { servicesSummary } = buildOrderSummaries([partial], [makeProduct(false)], []);

    expect(servicesSummary).not.toContain("cm (");
  });
});

describe("buildOrderSummaries — item name", () => {
  it("names a size-priced product with what the customer said it is", () => {
    const named: SavedProductCard = { ...card, modelNumber: "Grandfather clock" };

    const { productsSummary } = buildOrderSummaries([named], [makeProduct(false)], []);

    expect(productsSummary).toBe("Other furniture (Grandfather clock)");
  });

  it("leaves the product label alone when no name was given", () => {
    const { productsSummary } = buildOrderSummaries([card], [makeProduct(false)], []);

    expect(productsSummary).toBe("Other furniture");
  });

  it("does not add a model number to ordinary products", () => {
    const plain = { ...makeProduct(false), options: [] } as CatalogProduct;
    const withModel: SavedProductCard = { ...card, modelNumber: "WM-500", selectedExtraOptionIds: [] };

    expect(buildOrderSummaries([withModel], [plain], []).productsSummary).toBe("Other furniture");
  });
});
