import { describe, expect, it } from "vitest";
import { buildCardSummaryChips } from "./cardSummaryChips";

describe("buildCardSummaryChips", () => {
  it("summarizes delivery, installation and add-on count (no)", () => {
    expect(
      buildCardSummaryChips({
        locale: "no",
        deliveryType: "FIRST_STEP",
        installLabel: null,
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
        addonCount: 0,
      }),
    ).toEqual(["Levering: Kun montering", "Montering: Ingen"]);
  });
});
