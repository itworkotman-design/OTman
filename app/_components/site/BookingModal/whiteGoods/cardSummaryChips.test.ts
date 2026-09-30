import { describe, expect, it } from "vitest";
import { buildCardSummaryChips, formatSizeInfoChip } from "./cardSummaryChips";

describe("buildCardSummaryChips", () => {
  it("summarizes delivery, installation and add-on count (no)", () => {
    expect(
      buildCardSummaryChips({
        locale: "no",
        deliveryType: "FIRST_STEP",
        installLabel: null,
        showInstallChip: true,
        addonCount: 2,
      }),
    ).toEqual(["Levering: Ytterdør", "Montering: Ingen", "2 tillegg"]);
  });

  it("uses carry-in, install label and singular add-on (en)", () => {
    expect(
      buildCardSummaryChips({
        locale: "en",
        deliveryType: "INDOOR",
        installLabel: "Standard",
        showInstallChip: true,
        addonCount: 1,
      }),
    ).toEqual(["Delivery: Carry-in", "Installation: Standard", "1 add-on"]);
  });

  it("omits the add-on chip when none selected", () => {
    expect(
      buildCardSummaryChips({
        locale: "no",
        deliveryType: "INSTALL_ONLY",
        installLabel: null,
        showInstallChip: true,
        addonCount: 0,
      }),
    ).toEqual(["Levering: Kun montering", "Montering: Ingen"]);
  });

  it("omits the installation chip entirely when the product has no install options", () => {
    expect(
      buildCardSummaryChips({
        locale: "no",
        deliveryType: "FIRST_STEP",
        installLabel: null,
        showInstallChip: false,
        addonCount: 0,
      }),
    ).toEqual(["Levering: Ytterdør"]);
  });

  it("leads with the max-weight/dimensions chip when the product has one (pakke/pall)", () => {
    expect(
      buildCardSummaryChips({
        locale: "no",
        deliveryType: "FIRST_STEP",
        installLabel: null,
        showInstallChip: false,
        addonCount: 0,
        sizeInfo: { maxWeightKg: 15, dimensionsCm: { w: 20, h: 30, d: 40 } },
      }),
    ).toEqual(["Opptil 15 kg · 20×30×40 cm", "Levering: Ytterdør"]);
  });

  it("omits the size chip when the product has no sizeInfo", () => {
    expect(
      buildCardSummaryChips({
        locale: "en",
        deliveryType: "FIRST_STEP",
        installLabel: null,
        showInstallChip: false,
        addonCount: 0,
      }),
    ).toEqual(["Delivery: Doorstep"]);
  });
});

describe("formatSizeInfoChip", () => {
  it("formats weight and dimensions (no)", () => {
    expect(
      formatSizeInfoChip("no", { maxWeightKg: 15, dimensionsCm: { w: 20, h: 30, d: 40 } }),
    ).toBe("Opptil 15 kg · 20×30×40 cm");
  });

  it("formats weight and dimensions (en)", () => {
    expect(
      formatSizeInfoChip("en", { maxWeightKg: 50, dimensionsCm: { w: 50, h: 50, d: 50 } }),
    ).toBe("Up to 50 kg · 50×50×50 cm");
  });

  it("formats weight alone when there are no dimensions (half-pallet/pallet)", () => {
    expect(formatSizeInfoChip("no", { maxWeightKg: 100 })).toBe("Opptil 100 kg");
    expect(formatSizeInfoChip("en", { maxWeightKg: 500 })).toBe("Up to 500 kg");
  });

  it("returns null when there is no size info", () => {
    expect(formatSizeInfoChip("no", null)).toBeNull();
  });
});
