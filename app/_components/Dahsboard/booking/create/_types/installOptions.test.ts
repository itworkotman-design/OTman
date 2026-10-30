import { describe, expect, it } from "vitest";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import type { ProductDeliveryType } from "@/lib/products/deliveryTypes";
import type { CatalogOption, CatalogProduct } from "./productCard";
import {
  getDefaultInstallOptionIds,
  getProductInstallOptions,
} from "./installOptions";

function option(overrides: Partial<CatalogOption>): CatalogOption {
  return {
    id: "opt",
    code: "INSTALL",
    label: "Install",
    description: null,
    category: "install",
    customerPrice: "0",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "0",
    active: true,
    ...overrides,
  };
}

function deliveryType(
  overrides: Partial<ProductDeliveryType>,
): ProductDeliveryType {
  return {
    key: DELIVERY_TYPES.INDOOR,
    enabled: true,
    code: "INDOOR",
    label: "Indoor",
    price: "0",
    xtraPrice: "0",
    allowInstallOptions: true,
    allowExtraServices: true,
    allowReturnOptions: true,
    allowModelNumber: true,
    ...overrides,
  };
}

function product(overrides: Partial<CatalogProduct>): CatalogProduct {
  return {
    id: "p1",
    code: "P1",
    label: "Product",
    active: true,
    productType: "PHYSICAL",
    allowDeliveryTypes: false,
    allowInstallOptions: true,
    allowReturnOptions: false,
    allowExtraServices: false,
    allowDemont: false,
    allowQuantity: false,
    allowPeopleCount: false,
    allowHoursInput: false,
    allowModelNumber: false,
    autoXtraPerPallet: false,
    deliveryTypes: [],
    customSections: [],
    options: [],
    ...overrides,
  };
}

describe("getDefaultInstallOptionIds", () => {
  it("selects the only install option", () => {
    const p = product({ options: [option({ id: "a" })] });
    expect(getDefaultInstallOptionIds(p, "")).toEqual(["a"]);
  });

  it("selects nothing when there are several install options", () => {
    const p = product({
      options: [option({ id: "a" }), option({ id: "b", code: "INSTALL2" })],
    });
    expect(getDefaultInstallOptionIds(p, "")).toEqual([]);
  });

  it("selects nothing when the product does not allow install options", () => {
    const p = product({
      allowInstallOptions: false,
      options: [option({ id: "a" })],
    });
    expect(getDefaultInstallOptionIds(p, "")).toEqual([]);
  });

  it("selects nothing when the only option is inactive", () => {
    const p = product({ options: [option({ id: "a", active: false })] });
    expect(getDefaultInstallOptionIds(p, "")).toEqual([]);
  });

  it("respects the delivery type's allowInstallOptions flag", () => {
    const p = product({
      allowDeliveryTypes: true,
      deliveryTypes: [
        deliveryType({ key: DELIVERY_TYPES.INDOOR, allowInstallOptions: true }),
        deliveryType({
          key: DELIVERY_TYPES.FIRST_STEP,
          code: "FIRST",
          allowInstallOptions: false,
        }),
      ],
      options: [option({ id: "a" })],
    });
    expect(getDefaultInstallOptionIds(p, DELIVERY_TYPES.INDOOR)).toEqual(["a"]);
    expect(getDefaultInstallOptionIds(p, DELIVERY_TYPES.FIRST_STEP)).toEqual([]);
    expect(getDefaultInstallOptionIds(p, "")).toEqual([]);
  });

  it("returns nothing without a product", () => {
    expect(getDefaultInstallOptionIds(null, "")).toEqual([]);
  });
});

describe("getProductInstallOptions", () => {
  it("falls back to plain choice options when nothing is categorized as install", () => {
    const p = product({
      options: [option({ id: "c", code: "CHOICE", category: null })],
    });
    expect(getProductInstallOptions(p).map((o) => o.id)).toEqual(["c"]);
  });
});
