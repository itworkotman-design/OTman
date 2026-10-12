import { describe, expect, it } from "vitest";
import {
  areDriverNamesEquivalent,
  getDriverDisplayLabel,
  getKnownDriverFilterOptions,
  isNoDriverValue,
  matchesDriverFilter,
} from "@/lib/orders/driverNormalization";

describe("driver normalization", () => {
  it("returns the configured driver list", () => {
    expect(getKnownDriverFilterOptions()).toEqual([
      { id: "gints", label: "Gints" },
      { id: "matiss", label: "Matiss" },
      { id: "otto", label: "Otto" },
      { id: "ronalds", label: "Ronalds" },
      { id: "altin", label: "Altin" },
      { id: "arno", label: "Arno" },
      { id: "edijs", label: "Edijs" },
      { id: "gabriel", label: "Gabriel" },
      { id: "learning-team", label: "Learning team" },
      { id: "maris", label: "Maris" },
      { id: "norsen", label: "Norsen" },
    ]);
  });

  it("normalizes casing and a unique one-character spelling error", () => {
    expect(areDriverNamesEquivalent("Ronalds", "ronallds")).toBe(true);
    expect(getDriverDisplayLabel("ronalds")).toBe("Ronalds");
    expect(getDriverDisplayLabel("ronallds")).toBe("Ronalds");
    expect(matchesDriverFilter("ronallds", "ronalds")).toBe(true);
  });

  it("normalizes comma and slash separated multi-driver values", () => {
    expect(getDriverDisplayLabel("-otto, edijs")).toBe("Otto, Edijs");
    expect(getDriverDisplayLabel("-otto/ edijs")).toBe("Otto, Edijs");
    expect(matchesDriverFilter("-otto/ edijs", "otto")).toBe(true);
    expect(matchesDriverFilter("-otto/ edijs", "edijs")).toBe(true);
    expect(matchesDriverFilter("-otto/ edijs", "gints")).toBe(false);
  });

  it("maps blank, zero, and dash values to no driver", () => {
    expect(["", "   ", "0", "-", "—"].every(isNoDriverValue)).toBe(true);
    expect(matchesDriverFilter("0", "__none__")).toBe(true);
    expect(getDriverDisplayLabel("-")).toBe("No driver");
  });

  it("preserves unknown names without adding them to the configured options", () => {
    expect(getDriverDisplayLabel("new DRIVER")).toBe("new DRIVER");
    expect(getKnownDriverFilterOptions()).not.toContainEqual({
      id: "new-driver",
      label: "New Driver",
    });
  });

  it("does not fuzzy-match short arbitrary names or numbered labels", () => {
    expect(areDriverNamesEquivalent("Bo", "Jo")).toBe(false);
    expect(areDriverNamesEquivalent("Driver 1", "Driver 2")).toBe(false);
  });
});
