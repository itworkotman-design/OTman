import { describe, expect, it } from "vitest";
import type { SavedProductCard, WordpressImportReadOnlySnapshot } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { CalculatedLine, PriceLookup, ProductBreakdown } from "@/lib/booking/pricing/types";
import { createDefaultPriceListSettings } from "@/lib/products/priceListSettings";
import { shouldClearWordpressImportReadOnly } from "@/lib/booking/wordpressReadOnlyCleanup";

function buildSnapshot(value: Partial<WordpressImportReadOnlySnapshot>): WordpressImportReadOnlySnapshot {
  return {
    productName: "Imported product",
    comment: "Mismatch",
    rows: [],
    ...value,
  };
}

function buildCard(value: Partial<SavedProductCard>): SavedProductCard {
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

function buildBreakdown(value: Partial<ProductBreakdown>): ProductBreakdown {
  return {
    productName: "Product",
    items: [],
    ...value,
  };
}

function buildNativeLine(value: Partial<CalculatedLine>): CalculatedLine {
  return {
    label: "Line",
    qty: 1,
    unitPrice: 0,
    lineTotal: 0,
    ...value,
  };
}

describe("shouldClearWordpressImportReadOnly", () => {
  it("clears when WP rows structurally match AND totals match exactly", () => {
    const card = buildCard({
      pricingSnapshot: null,
      wordpressImportReadOnly: buildSnapshot({
        rows: [
          { label: "WP row", quantity: 2, priceCents: 5000 },
          { label: "WP row 2", quantity: 1, priceCents: 3000 },
        ],
      }),
    });
    // Breakdown with items that produce matching totals (100 + 30 = 130)
    const breakdown = buildBreakdown({
      items: [
        {
          kind: "productOption" as const,
          productOptionId: "opt-1",
          qty: 1,
        },
        {
          kind: "productOption" as const,
          productOptionId: "opt-2",
          qty: 1,
        },
      ],
    });
    // Native lines match WP row totals: 2*5000=10000 (100), 1*3000=3000 (30)
    const nativeLines = [buildNativeLine({ label: "Line 1", lineTotal: 100 }), buildNativeLine({ label: "Line 2", lineTotal: 30 })];
    const priceLookup: PriceLookup = {
      "opt-1": { label: "Option 1", code: "OPT1", customerPrice: 100, subcontractorPrice: 50 },
      "opt-2": { label: "Option 2", code: "OPT2", customerPrice: 30, subcontractorPrice: 15 },
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

  it("does not clear when WP rows structurally match but customer total differs", () => {
    const card = buildCard({
      pricingSnapshot: null,
      wordpressImportReadOnly: buildSnapshot({
        rows: [{ label: "WP XTRA", quantity: 2, priceCents: 5000 }],
      }),
    });
    // Breakdown produces different total (80 vs 100)
    const breakdown = buildBreakdown({
      items: [
        {
          kind: "productOption" as const,
          productOptionId: "opt-1",
          qty: 1,
        },
      ],
    });
    const nativeLines = [buildNativeLine({ label: "Different label", lineTotal: 80 })];
    const priceLookup: PriceLookup = {
      "opt-1": { label: "Option 1", code: "OPT1", customerPrice: 80, subcontractorPrice: 40 },
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

  it("does not clear when WP rows structurally match but subcontractor total differs", () => {
    const card = buildCard({
      pricingSnapshot: null,
      wordpressImportReadOnly: buildSnapshot({
        rows: [{ label: "WP row", quantity: 1, priceCents: 10000 }],
        subcontractorTotalCents: 5000,
      }),
    });
    const breakdown = buildBreakdown({
      items: [
        {
          kind: "productOption" as const,
          productOptionId: "opt-1",
          qty: 1,
        },
      ],
    });
    const nativeLines = [buildNativeLine({ label: "Line", lineTotal: 100 })];
    const priceLookup: PriceLookup = {
      "opt-1": { label: "Option 1", code: "OPT1", customerPrice: 100, subcontractorPrice: 60 },
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
