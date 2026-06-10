import { describe, expect, it } from "vitest";
import {
  getDeviationFeeOption,
  normalizeDeviationLabel,
} from "./deviationFees";

describe("deviationFees", () => {
  it("matches Norwegian WordPress values to the Norwegian deviation option", () => {
    const option = getDeviationFeeOption(
      "590:Avvik, bomtur; Kunde ikke hjemme:NOTHOME",
    );

    expect(option).toEqual(
      expect.objectContaining({
        code: "NOTHOME",
        norwegianLabel: "Avvik, bomtur; Kunde ikke hjemme",
        price: 590,
      }),
    );
  });

  it("normalizes Norwegian labels with different casing", () => {
    expect(normalizeDeviationLabel("avvik, bomtur; feil adresse")).toBe(
      "Avvik, bomtur; Feil adresse",
    );
    expect(
      normalizeDeviationLabel("Avvik, bomtur; Avlyst dagen før"),
    ).toBe("Avvik, bomtur; Avlyst dagen før");
  });
});
