import { describe, expect, it } from "vitest";
import type {
  SavedProductCard,
  WordpressImportReadOnlySnapshot,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type {
  CalculatedLine,
  PriceLookup,
  ProductBreakdown,
} from "@/lib/booking/pricing/types";
import { createDefaultPriceListSettings } from "@/lib/products/priceListSettings";
import { shouldClearWordpressImportReadOnly } from "@/lib/booking/wordpressReadOnlyCleanup";

function buildSnapshot(
  value: Partial<WordpressImportReadOnlySnapshot>,
): WordpressImportReadOnlySnapshot {
  return {
    productName: "Imported product",
    comment: "Mismatch",
    rows: [],
    ...value,
  };
}

function buildCard(
  value: Partial<SavedProductCard>,
): SavedProductCard {
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
    pricingSnapshot: null,
    wordpressImportReadOnly: buildSnapshot({
      rows: [{ label: "WordPress row", quantity: 1, priceCents: 10000 }],
    }),
    ...value,
  };
}

function buildBreakdown(
  value: Partial<ProductBreakdown>,
): ProductBreakdown {
  return {
    productName: "Product",
    items: [],
    ...value,
  };
}

function buildNativeLine(
  value: Partial<CalculatedLine>,
): CalculatedLine {
  return {
    label: "Line",
    qty: 1,
    unitPrice: 0,
    lineTotal: 0,
    ...value,
  };
}

describe("shouldClearWordpressImportReadOnly", () => {
  it("clears when pricing snapshot is null and per-card customer and subcontractor totals match", () => {
    const card = buildCard({
      pricingSnapshot: null,
      wordpressImportReadOnly: buildSnapshot({
        rows: [{ label: "WP XTRA", quantity: 2, priceCents: 5000 }],
        subcontractorTotalCents: 7000,
      }),
      selectedExtraOptionIds: ["xtra-option"],
    });
    const breakdown = buildBreakdown({
      items: [
        {
          kind: "productOption",
          productOptionId: "xtra-option",
          qty: 1,
        },
      ],
    });
    const nativeLines = [buildNativeLine({ label: "Different label", lineTotal: 100 })];
    const priceLookup: PriceLookup = {
      "xtra-option": {
        label: "Mapped XTRA",
        code: "XTRA",
        customerPrice: 100,
        subcontractorPrice: 70,
      },
    };

    expect(
      shouldClearWordpressImportReadOnly({
        card,
        breakdown,
        nativeLines,
        priceLookup,
      }),
    ).toBe(true);
  });

  it("does not clear when pricing snapshot is null and subcontractor totals differ", () => {
    const card = buildCard({
      pricingSnapshot: null,
      wordpressImportReadOnly: buildSnapshot({
        rows: [{ label: "WP XTRA", quantity: 2, priceCents: 5000 }],
        subcontractorTotalCents: 7500,
      }),
      selectedExtraOptionIds: ["xtra-option"],
    });
    const breakdown = buildBreakdown({
      items: [
        {
          kind: "productOption",
          productOptionId: "xtra-option",
          qty: 1,
        },
      ],
    });
    const nativeLines = [buildNativeLine({ label: "Different label", lineTotal: 100 })];
    const priceLookup: PriceLookup = {
      "xtra-option": {
        label: "Mapped XTRA",
        code: "XTRA",
        customerPrice: 100,
        subcontractorPrice: 70,
      },
    };

    expect(
      shouldClearWordpressImportReadOnly({
        card,
        breakdown,
        nativeLines,
        priceLookup,
      }),
    ).toBe(false);
  });

  it("still requires WP row coverage when a pricing snapshot exists", () => {
    const card = buildCard({
      pricingSnapshot: {
        autoDeliveryPrices: {},
        customSectionOptions: {},
        deliveryTypes: {},
        priceListSettings: createDefaultPriceListSettings(),
        productOptions: {},
        specialOptions: {},
      },
      wordpressImportReadOnly: buildSnapshot({
        rows: [{ label: "WP row", quantity: 2, priceCents: 5000 }],
        subcontractorTotalCents: 7000,
      }),
    });
    const breakdown = buildBreakdown({
      items: [
        {
          kind: "customPrice",
          code: "XTRA",
          label: "Mapped XTRA",
          qty: 1,
          unitPrice: 100,
          subcontractorUnitPrice: 70,
        },
      ],
    });
    const nativeLines = [buildNativeLine({ label: "Partial line", lineTotal: 70 })];

    expect(
      shouldClearWordpressImportReadOnly({
        card,
        breakdown,
        nativeLines,
        priceLookup: {},
      }),
    ).toBe(false);
  });
});
