import { describe, expect, it } from "vitest";
import {
  hasExtrasStepContent,
  hasInstallStepContent,
  offersCarryIn,
  showsNoInstallOption,
} from "./cardSectionVisibility";
import { catalogProductFromSeed } from "@/lib/content/websiteCatalogFixtures";

describe("hasInstallStepContent", () => {
  it("is false when the product has no assembly groups, type options or pending note (pakke/pall)", () => {
    expect(
      hasInstallStepContent({
        assemblyGroupCount: 0,
        typeOptionCount: 0,
        hasNeedsImplementationNote: false,
        deliveryType: "INDOOR",
      }),
    ).toBe(false);
  });

  it("is true when there are type options (e.g. white goods install types)", () => {
    expect(
      hasInstallStepContent({
        assemblyGroupCount: 0,
        typeOptionCount: 2,
        hasNeedsImplementationNote: false,
        deliveryType: "INDOOR",
      }),
    ).toBe(true);
  });

  it("is true when there are furniture assembly groups", () => {
    expect(
      hasInstallStepContent({
        assemblyGroupCount: 1,
        typeOptionCount: 0,
        hasNeedsImplementationNote: false,
        deliveryType: "INDOOR",
      }),
    ).toBe(true);
  });

  it("is true when only a pending-implementation note applies", () => {
    expect(
      hasInstallStepContent({
        assemblyGroupCount: 0,
        typeOptionCount: 0,
        hasNeedsImplementationNote: true,
        deliveryType: "INDOOR",
      }),
    ).toBe(true);
  });

  it("is false for doorstep delivery (FIRST_STEP), even when install/assembly options exist", () => {
    expect(
      hasInstallStepContent({
        assemblyGroupCount: 1,
        typeOptionCount: 2,
        hasNeedsImplementationNote: true,
        deliveryType: "FIRST_STEP",
      }),
    ).toBe(false);
  });

  it("is still shown before a delivery type is picked", () => {
    expect(
      hasInstallStepContent({
        assemblyGroupCount: 0,
        typeOptionCount: 2,
        hasNeedsImplementationNote: false,
        deliveryType: "",
      }),
    ).toBe(true);
  });
});

describe("hasExtrasStepContent", () => {
  const base = {
    showExtras: false,
    showReturn: false,
    furnitureAddonsVisible: false,
    isFurniture: false,
    installSelected: false,
    hasUnpackingOption: false,
    hasDemontOption: false,
    hasPalletPickupOption: false,
    dismantlingGroupCount: 0,
    hasAnchoringOption: false,
    hasReturnOption: false,
  };

  it("is false for a product with a delivery type picked but no extras/return options at all (pakke/pall)", () => {
    expect(hasExtrasStepContent({ ...base, showExtras: true })).toBe(false);
  });

  it("is true when unpacking is offered and extras are shown", () => {
    expect(
      hasExtrasStepContent({
        ...base,
        showExtras: true,
        hasUnpackingOption: true,
      }),
    ).toBe(true);
  });

  it("is true when dismantling is offered for furniture", () => {
    expect(
      hasExtrasStepContent({
        ...base,
        furnitureAddonsVisible: true,
        dismantlingGroupCount: 1,
      }),
    ).toBe(true);
  });

  it("is true when a return option is offered and shown", () => {
    expect(
      hasExtrasStepContent({
        ...base,
        showReturn: true,
        hasReturnOption: true,
      }),
    ).toBe(true);
  });

  it("is true for furniture unpacking included in assembly even when showExtras is false", () => {
    expect(
      hasExtrasStepContent({
        ...base,
        isFurniture: true,
        installSelected: true,
        hasUnpackingOption: true,
      }),
    ).toBe(true);
  });

  it("is true when pallet pickup is offered and extras are shown (half-pallet/pallet)", () => {
    expect(
      hasExtrasStepContent({
        ...base,
        showExtras: true,
        hasPalletPickupOption: true,
      }),
    ).toBe(true);
  });

  it("stays false for pallet pickup when extras aren't shown yet (no delivery type picked)", () => {
    expect(
      hasExtrasStepContent({
        ...base,
        hasPalletPickupOption: true,
      }),
    ).toBe(false);
  });
});

describe("showsNoInstallOption", () => {
  it("hides \"No installation\" when the card is installation only", () => {
    expect(showsNoInstallOption("INSTALL_ONLY")).toBe(false);
  });

  it("shows it for delivered cards and before a delivery type is picked", () => {
    expect(showsNoInstallOption("INDOOR")).toBe(true);
    expect(showsNoInstallOption("")).toBe(true);
  });
});

describe("offersCarryIn", () => {
  it("is false for pallets and half-pallets (doorstep only), true for everything else", () => {
    expect(offersCarryIn(catalogProductFromSeed("PKG_PALL").deliveryTypes)).toBe(false);
    expect(offersCarryIn(catalogProductFromSeed("PKG_HALVPALL").deliveryTypes)).toBe(false);
    expect(offersCarryIn(catalogProductFromSeed("PKG_ESKER").deliveryTypes)).toBe(true);
    expect(offersCarryIn(catalogProductFromSeed("WG_WASHING_MACHINE").deliveryTypes)).toBe(true);
  });

  it("is true for a product with no carry-in entry stored (older data)", () => {
    expect(offersCarryIn([])).toBe(true);
  });
});
