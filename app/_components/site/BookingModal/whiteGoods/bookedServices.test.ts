import { describe, expect, it } from "vitest";
import { createEmptyProductCard, type SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { allowedDeliveryTypes, isBookedService, keepBookedServices } from "./bookedServices";

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
