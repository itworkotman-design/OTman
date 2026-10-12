import { describe, expect, it } from "vitest";
import {
  createEmptyProductCard,
  type CatalogOption,
  type CatalogProduct,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { allowedDeliveryTypes, hasAddableServices, isBookedService, keepBookedServices } from "./bookedServices";

const booked: SavedProductCard = {
  ...createEmptyProductCard(0),
  productId: "p-wm",
  deliveryType: "FIRST_STEP",
  selectedInstallOptionIds: ["inst-type"],
  selectedExtraOptionIds: ["unpack"],
  selectedReturnOptionId: "return",
  demontEnabled: true,
};

describe("allowedDeliveryTypes", () => {
  it("is the booked delivery type and its upgrades (doorstep → carry-in)", () => {
    expect(allowedDeliveryTypes(booked)).toEqual(["FIRST_STEP", "INDOOR"]);
    expect(allowedDeliveryTypes({ ...booked, deliveryType: "INDOOR" })).toEqual(["INDOOR"]);
    expect(allowedDeliveryTypes({ ...booked, deliveryType: "INSTALL_ONLY" })).toEqual(["INSTALL_ONLY"]);
  });
});

describe("isBookedService", () => {
  it("is true for installation, extra and return options already on the card", () => {
    expect(isBookedService(booked, "inst-type")).toBe(true);
    expect(isBookedService(booked, "unpack")).toBe(true);
    expect(isBookedService(booked, "return")).toBe(true);
    expect(isBookedService(booked, "pallet")).toBe(false);
  });
});

describe("keepBookedServices", () => {
  it("lets services be added", () => {
    const next = { ...booked, selectedExtraOptionIds: ["unpack", "pallet"] };
    expect(keepBookedServices(booked, next).selectedExtraOptionIds).toEqual(["unpack", "pallet"]);
  });

  it("puts back a booked service that was unticked", () => {
    const next = { ...booked, selectedExtraOptionIds: [], selectedInstallOptionIds: [], selectedReturnOptionId: null, demontEnabled: false };
    expect(keepBookedServices(booked, next)).toEqual(booked);
  });

  it("keeps the booked services through an upgrade to carry-in (which otherwise clears add-ons)", () => {
    const next = { ...booked, deliveryType: "INDOOR" as const, selectedExtraOptionIds: [], selectedInstallOptionIds: [], selectedReturnOptionId: null, demontEnabled: false };
    expect(keepBookedServices(booked, next)).toEqual({ ...booked, deliveryType: "INDOOR" });
  });

  it("never moves the delivery type to something that isn't an upgrade", () => {
    const indoor = { ...booked, deliveryType: "INDOOR" as const };
    expect(keepBookedServices(indoor, { ...indoor, deliveryType: "FIRST_STEP" }).deliveryType).toBe("INDOOR");
    expect(keepBookedServices(booked, { ...booked, deliveryType: "INSTALL_ONLY" }).deliveryType).toBe("FIRST_STEP");
  });

  it("leaves everything that isn't a service as it is", () => {
    const next = { ...booked, modelNumber: "Sofa", amount: 1 };
    expect(keepBookedServices(booked, next).modelNumber).toBe("Sofa");
  });
});

function option(id: string, code: string): CatalogOption {
  return {
    id,
    code,
    label: code,
    description: null,
    category: null,
    customerPrice: "100",
    subcontractorPrice: "50",
    effectiveCustomerPrice: "100",
    active: true,
  };
}

function product(code: string, options: CatalogOption[]): CatalogProduct {
  return { code, options } as CatalogProduct;
}

describe("hasAddableServices", () => {
  const dishwasher = product("WG_DISHWASHER", [
    option("inst", "DISHWASHER_STD_WET"),
    option("unpack", "UNPACKING"),
    option("demont", "DEMONT"),
    option("return", "RETURN_RECYCLING"),
  ]);
  const doorstep: SavedProductCard = { ...createEmptyProductCard(0), productId: "p-dw", deliveryType: "FIRST_STEP" };

  it("is true while an additional service isn't booked yet", () => {
    expect(hasAddableServices(dishwasher, doorstep)).toBe(true);
    expect(hasAddableServices(dishwasher, { ...doorstep, selectedExtraOptionIds: ["unpack"], demontEnabled: true })).toBe(true);
  });

  it("is false once every additional service is booked", () => {
    const full = { ...doorstep, selectedExtraOptionIds: ["unpack"], demontEnabled: true, selectedReturnOptionId: "return" };
    expect(hasAddableServices(dishwasher, full)).toBe(false);
  });

  it("ignores extras the card doesn't offer once installation is booked (only return is left)", () => {
    const installed = { ...doorstep, deliveryType: "INDOOR" as const, selectedInstallOptionIds: ["inst"] };
    expect(hasAddableServices(dishwasher, installed)).toBe(true);
    expect(hasAddableServices(dishwasher, { ...installed, selectedReturnOptionId: "return" })).toBe(false);
  });

  it("is false for a product with no additional services", () => {
    expect(hasAddableServices(product("WG_DISHWASHER", [option("inst", "DISHWASHER_STD_WET")]), doorstep)).toBe(false);
  });

  it("counts a furniture dismantling type as booked when either variant is", () => {
    const sofa = product("FN_SOFA", [option("disp", "DISMANTLE_DISP_SOFA"), option("car", "DISMANTLE_CAR_SOFA")]);
    expect(hasAddableServices(sofa, doorstep)).toBe(true);
    expect(hasAddableServices(sofa, { ...doorstep, selectedExtraOptionIds: ["car"] })).toBe(false);
  });
});
