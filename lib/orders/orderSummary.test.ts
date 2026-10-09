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

  it("doesn't repeat the card's delivery type for its priced delivery lines (full price + extra units)", () => {
    const base = { cardId: 10, productName: "Boxes", deliveryType: "Delivery with carry-in" };
    const groups = buildOrderSummaryGroups([
      { ...base, itemType: "PRODUCT_CARD", optionCode: null, optionLabel: null, quantity: 3, rawData: { amount: 3 } },
      { ...base, itemType: "EXTRA_OPTION", optionCode: "INDOOR", optionLabel: "Delivery with carry-in", quantity: 1, rawData: { source: "delivery_type_price" } },
      { ...base, itemType: "EXTRA_OPTION", optionCode: "INDOOR", optionLabel: "Delivery with carry-in", quantity: 2, rawData: { source: "white_goods_extra_unit" } },
      { ...base, itemType: "EXTRA_OPTION", optionCode: "UNPACKING", optionLabel: "Unpacking", quantity: 3, rawData: { description: "Utpakking" } },
    ]);

    expect(groups).toEqual([{ title: "Boxes x3", details: ["Delivery with carry-in x3", "Utpakking x3"] }]);
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

  it("builds archive groups when rawData is omitted", () => {
    const groups = buildOrderSummaryGroups([
      {
        cardId: 1,
        productName: "Washer",
        deliveryType: "Indoor carry",
        itemType: "PRODUCT_CARD",
        optionCode: null,
        optionLabel: null,
        quantity: 1,
      },
      {
        cardId: 1,
        productName: "Washer",
        deliveryType: "Indoor carry",
        itemType: "SPECIAL_OPTION",
        optionCode: "INSTALL",
        optionLabel: "Install only",
        quantity: 1,
      },
    ]);

    expect(groups).toEqual([
      {
        title: "Washer",
        details: ["Indoor carry", "Install only"],
      },
    ]);
  });
});
