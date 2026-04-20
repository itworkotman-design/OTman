import { describe, expect, it } from "vitest";
import {
  buildLegacyOrderSummaryGroups,
  buildOrderSummaryGroups,
  formatOrderSummaryText,
} from "@/lib/orders/orderSummary";

describe("orderSummary", () => {
  it("groups order items by card and formats compact quantities", () => {
    const groups = buildOrderSummaryGroups([
      {
        cardId: 2,
        productName: "Dryer",
        deliveryType: "First step",
        itemType: "PRODUCT_CARD",
        optionCode: null,
        optionLabel: null,
        quantity: 2,
        rawData: null,
      },
      {
        cardId: 2,
        productName: "Dryer",
        deliveryType: "First step",
        itemType: "EXTRA_OPTION",
        optionCode: "RETURN_ONLY",
        optionLabel: "Return only",
        quantity: 2,
        rawData: null,
      },
      {
        cardId: 1,
        productName: "Washer",
        deliveryType: "Indoor carry",
        itemType: "PRODUCT_CARD",
        optionCode: null,
        optionLabel: null,
        quantity: 1,
        rawData: null,
      },
      {
        cardId: 1,
        productName: "Washer",
        deliveryType: "Indoor carry",
        itemType: "SPECIAL_OPTION",
        optionCode: "INSTALL",
        optionLabel: "Install only",
        quantity: 1,
        rawData: {
          description: "Install only",
        },
      },
    ]);

    expect(groups).toEqual([
      {
        title: "Washer",
        details: ["Indoor carry", "Install only"],
      },
      {
        title: "Dryer x2",
        details: ["First step x2", "Return only x2"],
      },
    ]);

    expect(formatOrderSummaryText(groups)).toBe(
      [
        "Washer",
        "- Indoor carry",
        "- Install only",
        "",
        "Dryer x2",
        "- First step x2",
        "- Return only x2",
      ].join("\n"),
    );
  });

  it("builds a legacy fallback group when order items are missing", () => {
    expect(
      buildLegacyOrderSummaryGroups({
        productsSummary: "Washer x2, Dryer",
        deliveryTypeSummary: "Indoor carry x2, First step",
        servicesSummary: "Install only, Return only",
      }),
    ).toEqual([
      {
        title: "Washer x2, Dryer",
        details: [
          "Indoor carry x2, First step",
          "Install only",
          "Return only",
        ],
      },
    ]);
  });
});
