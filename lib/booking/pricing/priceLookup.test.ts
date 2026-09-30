import { describe, expect, it } from "vitest";
import { buildPriceLookup } from "./priceLookup";
import type { CatalogOption, CatalogProduct, CatalogSpecialOption } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

function makeOption(overrides: Partial<CatalogOption> = {}): CatalogOption {
  return {
    id: "opt-1",
    code: "UNPACKING",
    label: "Unpacking and disposal of packaging",
    description: "Utpakking og kasting av emballasje",
    category: "extra",
    customerPrice: "0",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "0",
    active: true,
    ...overrides,
  };
}

function makeProduct(options: CatalogOption[]): CatalogProduct {
  return {
    id: "prod-1",
    code: "PKG_ESKER",
    label: "Boxes",
    active: true,
    productType: "PHYSICAL",
    allowDeliveryTypes: true,
    allowInstallOptions: false,
    allowReturnOptions: false,
    allowExtraServices: true,
    allowDemont: false,
    allowQuantity: true,
    allowPeopleCount: false,
    allowHoursInput: false,
    allowModelNumber: false,
    autoXtraPerPallet: false,
    deliveryTypes: [],
    customSections: [],
    options,
  };
}

function makeSpecialOption(overrides: Partial<CatalogSpecialOption> = {}): CatalogSpecialOption {
  return {
    id: "special-1",
    type: "extra_service",
    code: "SOME_FEE",
    label: "Express fee",
    description: "Ekspressgebyr",
    customerPrice: "0",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "0",
    active: true,
    ...overrides,
  };
}

describe("buildPriceLookup", () => {
  it("defaults to the Norwegian description when no locale is passed (dashboard/backend behavior, unchanged)", () => {
    const lookup = buildPriceLookup([makeProduct([makeOption()])], []);
    expect(lookup["opt-1"].label).toBe("Utpakking og kasting av emballasje");
  });

  it("prefers the Norwegian description for locale: 'no'", () => {
    const lookup = buildPriceLookup([makeProduct([makeOption()])], [], { locale: "no" });
    expect(lookup["opt-1"].label).toBe("Utpakking og kasting av emballasje");
  });

  it("prefers the English label for locale: 'en' (website order summary)", () => {
    const lookup = buildPriceLookup([makeProduct([makeOption()])], [], { locale: "en" });
    expect(lookup["opt-1"].label).toBe("Unpacking and disposal of packaging");
  });

  it("falls back to the code when both label and description are missing", () => {
    const lookup = buildPriceLookup(
      [makeProduct([makeOption({ label: "", description: null })])],
      [],
      { locale: "en" },
    );
    expect(lookup["opt-1"].label).toBe("UNPACKING");
  });

  it("applies the same locale preference to special options", () => {
    const lookup = buildPriceLookup([], [makeSpecialOption()], { locale: "en" });
    expect(lookup["special-1"].label).toBe("Express fee");

    const lookupNo = buildPriceLookup([], [makeSpecialOption()], { locale: "no" });
    expect(lookupNo["special-1"].label).toBe("Ekspressgebyr");
  });
});
