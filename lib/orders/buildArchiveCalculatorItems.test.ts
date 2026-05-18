import { describe, expect, it } from "vitest";
import { buildArchiveCalculatorItems } from "./buildArchiveCalculatorItems";

describe("buildArchiveCalculatorItems", () => {
  it("uses saved WordPress fallback rows for unmatched cards", () => {
    const items = buildArchiveCalculatorItems({
      orderItems: [
        {
          cardId: 1,
          productCode: "WASHER",
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
          productCode: "WASHER",
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

    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        cardId: 1,
        itemType: "EXTRA_OPTION",
        productCode: "WASHER",
        optionCode: "XTRA",
        optionLabel: "XTRA",
        customerPriceCents: 10000,
      }),
      expect.objectContaining({
        cardId: 1,
        itemType: "EXTRA_OPTION",
        productCode: "",
        optionCode: "EXTRAPICKUP",
        optionLabel: "EXTRA PICKUP",
        customerPriceCents: 59000,
        subcontractorPriceCents: 39000,
      }),
    ]));
  });

  it("keeps native calculator items for fully mapped cards", () => {
    const items = buildArchiveCalculatorItems({
      orderItems: [
        {
          cardId: 2,
          productCode: "DRYER",
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
        productCode: "DRYER",
        optionCode: "INSTALL",
        customerPriceCents: 25000,
        subcontractorPriceCents: 15000,
      }),
    ]);
  });

  it("keeps priced product-card and delivery rows for read-only role calculators", () => {
    const items = buildArchiveCalculatorItems({
      orderItems: [
        {
          cardId: 3,
          productCode: "FRIDGE",
          productName: "Kjoleskap",
          deliveryType: "Indoor",
          itemType: "PRODUCT_CARD",
          optionCode: null,
          optionLabel: null,
          quantity: 1,
          customerPriceCents: 49900,
          subcontractorPriceCents: 30000,
        },
        {
          cardId: 3,
          productCode: "FRIDGE",
          productName: "Kjoleskap",
          deliveryType: "Indoor",
          itemType: "EXTRA_OPTION",
          optionCode: "INDOOR",
          optionLabel: null,
          quantity: 1,
          customerPriceCents: 66900,
          subcontractorPriceCents: 61900,
        },
      ],
      productCardsSnapshot: [],
    });

    expect(items).toEqual([
      expect.objectContaining({
        cardId: 3,
        productCode: "FRIDGE",
        itemType: "PRODUCT_CARD",
        customerPriceCents: 49900,
      }),
      expect.objectContaining({
        cardId: 3,
        productCode: "FRIDGE",
        itemType: "EXTRA_OPTION",
        optionCode: "INDOOR",
        optionLabel: "",
        customerPriceCents: 66900,
      }),
    ]);
  });

  it("falls back to persisted order items when WordPress read-only snapshot has no price rows", () => {
    const items = buildArchiveCalculatorItems({
      orderItems: [
        {
          cardId: 4,
          productCode: "TV",
          productName: "TV",
          deliveryType: "Indoor",
          itemType: "EXTRA_OPTION",
          optionCode: "INDOOR",
          optionLabel: "Indoor",
          quantity: 1,
          customerPriceCents: 89800,
          subcontractorPriceCents: 70000,
        },
      ],
      productCardsSnapshot: [
        {
          cardId: 4,
          productId: "product-4",
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
          wordpressImportReadOnly: {
            productName: "TV",
            comment: "New system was unable to match to old price",
            rows: [],
          },
        },
      ],
    });

    expect(items).toEqual([
      expect.objectContaining({
        cardId: 4,
        productCode: "TV",
        optionCode: "INDOOR",
        optionLabel: "Indoor",
        customerPriceCents: 89800,
      }),
    ]);
  });

  it("keeps WordPress unmatched rows when prices are stored as numeric strings", () => {
    const items = buildArchiveCalculatorItems({
      orderItems: [],
      productCardsSnapshot: [
        {
          cardId: 5,
          productId: null,
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
          pricingSnapshot: null,
          wordpressImportReadOnly: {
            productName: "WP unmatched",
            comment: "New system was unable to match to old price",
            rows: [
              {
                label: "KM pris",
                code: "WP_PRICE",
                quantity: 1,
                priceCents: "49900",
              },
            ],
          },
        },
      ],
    });

    expect(items).toEqual([
      expect.objectContaining({
        cardId: 5,
        itemType: "EXTRA_OPTION",
        optionCode: "WP_PRICE",
        optionLabel: "KM pris",
        customerPriceCents: 49900,
      }),
    ]);
  });
});
