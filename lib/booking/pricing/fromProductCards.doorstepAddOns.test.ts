import { describe, expect, it } from "vitest";
import { buildProductBreakdowns } from "./fromProductCards";
import { DEFAULT_PRODUCT_DELIVERY_TYPES } from "@/lib/products/deliveryTypes";
import { createDefaultProductAutoDeliveryPrice } from "@/lib/products/autoDeliveryPrice";
import {
  createEmptyProductCard,
  type CatalogProduct,
  type CatalogSpecialOption,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// Proves the mechanism the white-goods catalog relies on to offer
// Unpacking/Dismantling/Return on doorstep ("FIRST_STEP") delivery, matching
// the source spreadsheet — WITHOUT forking or editing any shared pricing
// file. Product.deliveryTypes already lets each product override
// allowInstallOptions/allowExtraServices/allowReturnOptions per delivery
// type; buildProductBreakdowns (shared, unmodified) honors that override
// when present and only falls back to the DEFAULT_PRODUCT_DELIVERY_TYPES-style
// restriction when a product has no per-type config. The second test in this
// file proves the dashboard's existing default behavior for FIRST_STEP is
// completely unaffected.

function buildFixtureProduct(overrides: Partial<CatalogProduct>): CatalogProduct {
  return {
    id: "product-1",
    code: "FIXTURE",
    label: "Fixture product",
    active: true,
    productType: "PHYSICAL",
    allowDeliveryTypes: true,
    allowInstallOptions: true,
    allowReturnOptions: true,
    allowExtraServices: true,
    allowDemont: true,
    allowQuantity: true,
    allowPeopleCount: false,
    allowHoursInput: false,
    allowModelNumber: true,
    autoXtraPerPallet: false,
    autoDeliveryPrice: createDefaultProductAutoDeliveryPrice(),
    deliveryTypes: DEFAULT_PRODUCT_DELIVERY_TYPES,
    customSections: [],
    options: [
      {
        id: "unpacking-option",
        code: "UNPACKING",
        label: "Unpacking",
        description: null,
        category: "extra",
        customerPrice: "103.20",
        subcontractorPrice: "51.60",
        effectiveCustomerPrice: "103.20",
        active: true,
      },
      {
        id: "demont-option",
        code: "DEMONT",
        label: "Dismantling",
        description: null,
        category: "extra",
        customerPrice: "205.37",
        subcontractorPrice: "102.17",
        effectiveCustomerPrice: "205.37",
        active: true,
      },
    ],
    ...overrides,
  };
}

const returnSpecialOption: CatalogSpecialOption = {
  id: "return-option",
  type: "return",
  code: "RETURN_RECYCLING",
  label: "Return for recycling",
  description: null,
  customerPrice: "258.00",
  subcontractorPrice: "154.80",
  effectiveCustomerPrice: "258.00",
  active: true,
};

function buildFixtureCard() {
  return {
    ...createEmptyProductCard(0),
    productId: "product-1",
    deliveryType: "FIRST_STEP" as const,
    selectedExtraOptionIds: ["unpacking-option"],
    demontEnabled: true,
    selectedReturnOptionId: returnSpecialOption.id,
  };
}

describe("doorstep (FIRST_STEP) add-on availability", () => {
  it("website white-goods products: Unpacking/Dismantling/Return price on doorstep delivery when the product's deliveryTypes data allows it", () => {
    const permissiveProduct = buildFixtureProduct({
      deliveryTypes: DEFAULT_PRODUCT_DELIVERY_TYPES.map((dt) =>
        dt.key === "FIRST_STEP"
          ? { ...dt, allowExtraServices: true, allowReturnOptions: true }
          : dt,
      ),
    });

    const breakdowns = buildProductBreakdowns(
      [buildFixtureCard()],
      [permissiveProduct],
      [returnSpecialOption],
    );

    const optionIds = breakdowns[0].items
      .filter((item) => item.kind === "productOption")
      .map((item) => item.productOptionId);

    expect(optionIds).toContain("unpacking-option");
    expect(optionIds).toContain("demont-option");
    expect(optionIds).toContain("return-option");
  });

  it("regression: the dashboard's existing default product config still hides them on doorstep delivery", () => {
    const defaultProduct = buildFixtureProduct({});

    const breakdowns = buildProductBreakdowns(
      [buildFixtureCard()],
      [defaultProduct],
      [returnSpecialOption],
    );

    const optionIds = breakdowns[0].items
      .filter((item) => item.kind === "productOption")
      .map((item) => item.productOptionId);

    expect(optionIds).not.toContain("unpacking-option");
    expect(optionIds).not.toContain("demont-option");
    expect(optionIds).not.toContain("return-option");
  });
});
