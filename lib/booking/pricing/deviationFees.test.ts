import { describe, expect, it } from "vitest";
import {
  getDeviationFeeOption,
  normalizeDeviationLabel,
} from "./deviationFees";

describe("deviationFees", () => {
  it("matches Norwegian WordPress values to the English deviation option", () => {
    const option = getDeviationFeeOption(
      "590:Avvik, bomtur; Kunde ikke hjemme:NOTHOME",
    );

    expect(option).toEqual(
      expect.objectContaining({
        code: "NOTHOME",
        englishLabel: "Deviation, missed trip; Customer not at home",
        price: 590,
      }),
    );
  });

  it("normalizes English and Norwegian labels with different casing", () => {
    expect(normalizeDeviationLabel("avvik, bomtur; feil adresse")).toBe(
      "Deviation, toll; Wrong address",
    );
    expect(
      normalizeDeviationLabel("DEVIATION, TOLL TRIP; CANCELLED THE DAY BEFORE"),
    ).toBe("Deviation, toll trip; Cancelled the day before");
  });
});
