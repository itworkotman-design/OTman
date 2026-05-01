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
  it("clears when WP rows structurally match native lines (exact price match)", () => {
    const card = buildCard({
      pricingSnapshot: null,
      wordpressImportReadOnly: buildSnapshot({
        rows: [
          { label: "WP row", quantity: 2, priceCents: 5000 },
          { label: "WP row 2", quantity: 1, priceCents: 3000 },
        ],
      }),
    });
    const breakdown = buildBreakdown({
      items: [],
    });
    // Native lines with exact matching totals
    const nativeLines = [
      buildNativeLine({ label: "Line 1", lineTotal: 100 }),
      buildNativeLine({ label: "Line 2", lineTotal: 30 }),
    ];
    const priceLookup: PriceLookup = {};

    expect(
      shouldClearWordpressImportReadOnly({
        card,
        breakdown,
        nativeLines,
        priceLookup,
      }),
    ).toBe(true);
  });

  it("does not clear when WP rows do not structurally match native lines", () => {
    const card = buildCard({
      pricingSnapshot: null,
      wordpressImportReadOnly: buildSnapshot({
        rows: [{ label: "WP XTRA", quantity: 2, priceCents: 5000 }],
      }),
    });
    const breakdown = buildBreakdown({
      items: [],
    });
    // Native line with different total (WP = 10000 cents, native = 8000 cents)
    const nativeLines = [buildNativeLine({ label: "Different label", lineTotal: 80 })];
    const priceLookup: PriceLookup = {};

    expect(
      shouldClearWordpressImportReadOnly({
        card,
        breakdown,
        nativeLines,
        priceLookup,
      }),
    ).toBe(false);
  });

  it("does not clear when WP rows are fewer than native lines", () => {
    const card = buildCard({
      pricingSnapshot: null,
      wordpressImportReadOnly: buildSnapshot({
        rows: [{ label: "WP row", quantity: 1, priceCents: 5000 }],
      }),
    });
    const breakdown = buildBreakdown({
      items: [],
    });
    // More native lines than WP rows
    const nativeLines = [
      buildNativeLine({ label: "Line 1", lineTotal: 50 }),
      buildNativeLine({ label: "Line 2", lineTotal: 30 }),
    ];
    const priceLookup: PriceLookup = {};

    expect(
      shouldClearWordpressImportReadOnly({
        card,
        breakdown,
        nativeLines,
        priceLookup,
      }),
    ).toBe(false);
  });

  it("does not clear when there is no wordpressImportReadOnly", () => {
    const card = buildCard({
      wordpressImportReadOnly: undefined,
    });
    const breakdown = buildBreakdown({
      items: [],
    });
    const nativeLines = [buildNativeLine({ label: "Line", lineTotal: 100 })];
    const priceLookup: PriceLookup = {};

    expect(
      shouldClearWordpressImportReadOnly({
        card,
        breakdown,
        nativeLines,
        priceLookup,
      }),
    ).toBe(false);
  });
});
