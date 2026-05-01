import { describe, expect, it } from "vitest";
import { buildArchiveCalculatorItems } from "./buildArchiveCalculatorItems";

describe("buildArchiveCalculatorItems", () => {
  it("uses saved WordPress fallback rows for unmatched cards", () => {
    const items = buildArchiveCalculatorItems({
      orderItems: [
        {
          cardId: 1,
          productName: "Washer",
          deliveryType: "Indoor",
          itemType: "PRODUCT_CARD",
          optionCode: null,
          optionLabel: null,
          quantity: 1,
          customerPriceCents: null,
          subcontractorPriceCents: null,
          rawData: {
            modelNumber: "M1",
          },
        },
        {
          cardId: 1,
          productName: "Washer",
          deliveryType: "Indoor",
          itemType: "EXTRA_OPTION",
          optionCode: "XTRA",
          optionLabel: "XTRA",
          quantity: 1,
          customerPriceCents: 10000,
          subcontractorPriceCents: 7000,
        },
      ],
      productCardsSnapshot: [
        {
          cardId: 1,
          productId: "product-1",
          modelNumber: "WP-1",
          deliveryType: "INDOOR",
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
          pricingSnapshot: null,
          wordpressImportReadOnly: {
            productName: "WP Washer",
            comment: "Mismatch",
            rows: [
              {
                label: "EXTRA PICKUP",
                code: "EXTRAPICKUP",
                quantity: 1,
                priceCents: 59000,
              },
            ],
            subcontractorRows: [
              {
                label: "EXTRA PICKUP",
                code: "EXTRAPICKUP",
                quantity: 1,
                priceCents: 39000,
              },
            ],
          },
        },
      ],
    });

    expect(items).toEqual([
      expect.objectContaining({
        cardId: 1,
        itemType: "PRODUCT_CARD",
        productName: "WP Washer",
        productModelNumber: "WP-1",
      }),
      expect.objectContaining({
        cardId: 1,
        itemType: "EXTRA_OPTION",
        optionCode: "EXTRAPICKUP",
        optionLabel: "EXTRA PICKUP",
        customerPriceCents: 59000,
        subcontractorPriceCents: 39000,
      }),
    ]);
  });

  it("keeps native calculator items for fully mapped cards", () => {
    const items = buildArchiveCalculatorItems({
      orderItems: [
        {
          cardId: 2,
          productName: "Dryer",
          deliveryType: "Indoor",
          itemType: "EXTRA_OPTION",
          optionCode: "INSTALL",
          optionLabel: "Install",
          quantity: 1,
          customerPriceCents: 25000,
          subcontractorPriceCents: 15000,
        },
      ],
      productCardsSnapshot: [
        {
          cardId: 2,
          productId: "product-2",
          modelNumber: "",
          deliveryType: "INDOOR",
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
          pricingSnapshot: null,
          wordpressImportReadOnly: null,
        },
      ],
    });

    expect(items).toEqual([
      expect.objectContaining({
        cardId: 2,
        itemType: "EXTRA_OPTION",
        optionCode: "INSTALL",
        customerPriceCents: 25000,
        subcontractorPriceCents: 15000,
      }),
    ]);
  });
});
