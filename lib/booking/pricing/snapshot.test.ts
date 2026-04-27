import { describe, expect, it } from "vitest";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { createDefaultProductDeliveryTypes } from "@/lib/products/deliveryTypes";
import { createDefaultPriceListSettings } from "@/lib/products/priceListSettings";
import type {
  CatalogProduct,
  CatalogSpecialOption,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import {
  applyOrderPricingSnapshot,
  buildOrderPricingSnapshot,
  pricingSnapshotsEqual,
} from "./snapshot";

function buildProduct(price: string): CatalogProduct {
  return {
    id: "product-1",
    code: "PROD-1",
    label: "Washer",
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
    allowModelNumber: true,
    autoXtraPerPallet: false,
    deliveryTypes: createDefaultProductDeliveryTypes(),
    customSections: [],
    options: [
      {
        id: "install-1",
        code: "INSTALL",
        label: "Install",
        description: "Install",
        category: "install",
        customerPrice: "500",
        subcontractorPrice: "200",
        effectiveCustomerPrice: price,
        active: true,
      },
    ],
  };
}

function buildCard(): SavedProductCard {
  return {
    cardId: 0,
    productId: "product-1",
    modelNumber: "",
    deliveryType: DELIVERY_TYPES.INDOOR,
    amount: 1,
    peopleCount: 1,
    hoursInput: 1,
    selectedInstallOptionIds: ["install-1"],
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
  };
}

const specialOptions: CatalogSpecialOption[] = [];

describe("order pricing snapshots", () => {
  it("overlays saved prices onto a changed catalog", () => {
    const card = buildCard();
    const priceListSettings = createDefaultPriceListSettings();
    const snapshot = buildOrderPricingSnapshot({
      productCards: [card],
      catalogProducts: [buildProduct("300")],
      catalogSpecialOptions: specialOptions,
      priceListSettings,
    });

    const applied = applyOrderPricingSnapshot({
      catalogProducts: [buildProduct("450")],
      catalogSpecialOptions: specialOptions,
      priceListSettings,
      pricingSnapshot: snapshot,
    });

    expect(applied.catalogProducts[0]?.options[0]?.effectiveCustomerPrice).toBe(
      "300",
    );
  });

  it("detects when current prices differ from the saved snapshot", () => {
    const card = buildCard();
    const priceListSettings = createDefaultPriceListSettings();
    const saved = buildOrderPricingSnapshot({
      productCards: [card],
      catalogProducts: [buildProduct("300")],
      catalogSpecialOptions: specialOptions,
      priceListSettings,
    });
    const current = buildOrderPricingSnapshot({
      productCards: [card],
      catalogProducts: [buildProduct("450")],
      catalogSpecialOptions: specialOptions,
      priceListSettings,
    });

    expect(pricingSnapshotsEqual(saved, current)).toBe(false);
  });
});
