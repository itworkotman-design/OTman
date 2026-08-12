import { describe, expect, it } from "vitest";
import { calculateDnbDiscountAdjustment, deriveDiscountSync } from "@/lib/booking/pricing/discountSync";

describe("deriveDiscountSync", () => {
  it("skips entirely on the initial sync for an existing order, regardless of any other input", () => {
    // Real bug (order with rabatt="610", a *manually entered*
    // subcontractorMinus="5500"): opening the editor — or saving any
    // unrelated field, which reloads the same form state — recomputed
    // subcontractorMinus from the ratio formula (610/8110 * 5500 = ~414)
    // and silently overwrote the manual "pay the subcontractor nothing"
    // override. The caller must never let a "just loaded this order" pass
    // reach the formula below.
    const result = deriveDiscountSync({
      dnbDiscount: false,
      manualRabatt: "610",
      leggTil: "",
      subtotalExVat: 8110,
      subcontractorBase: 5500,
      isInitialSyncForExistingOrder: true,
    });

    expect(result).toEqual({ skip: true });
  });

  it("does not skip for a brand-new order (no existing id to protect)", () => {
    const result = deriveDiscountSync({
      dnbDiscount: false,
      manualRabatt: "100",
      leggTil: "",
      subtotalExVat: 1000,
      subcontractorBase: 500,
      isInitialSyncForExistingOrder: false,
    });

    expect(result).toEqual({ skip: false, rabatt: "100", subcontractorMinus: "50" });
  });

  describe("manual rabatt (dnbDiscount off)", () => {
    it("derives subcontractorMinus proportional to the rabatt/subtotal ratio", () => {
      const result = deriveDiscountSync({
        dnbDiscount: false,
        manualRabatt: "610",
        leggTil: "",
        subtotalExVat: 8110,
        subcontractorBase: 5500,
        isInitialSyncForExistingOrder: false,
      });

      expect(result).toEqual({ skip: false, rabatt: "610", subcontractorMinus: "414" });
    });

    it("clears subcontractorMinus to an explicit empty string when rabatt is cleared", () => {
      const result = deriveDiscountSync({
        dnbDiscount: false,
        manualRabatt: "",
        leggTil: "",
        subtotalExVat: 8110,
        subcontractorBase: 5500,
        isInitialSyncForExistingOrder: false,
      });

      expect(result).toEqual({ skip: false, rabatt: "", subcontractorMinus: "" });
    });

    it("clears subcontractorMinus when the totals aren't loaded yet (subtotalExVat is 0)", () => {
      // This documents why the caller may only invoke this function on a
      // genuine dnbDiscount/manualRabatt change, never reactively on totals
      // changing: fed a transient subtotalExVat of 0 (e.g. while product
      // cards are still loading), this correctly — but destructively —
      // clears subcontractorMinus. Guarding *when* this runs is the
      // caller's responsibility (see isInitialSyncForExistingOrder above,
      // and the effect in BookingEditor.tsx that only depends on the
      // dnbDiscount toggle, not on totals).
      const result = deriveDiscountSync({
        dnbDiscount: false,
        manualRabatt: "610",
        leggTil: "",
        subtotalExVat: 0,
        subcontractorBase: 0,
        isInitialSyncForExistingOrder: false,
      });

      expect(result).toEqual({ skip: false, rabatt: "610", subcontractorMinus: "" });
    });

    it("rounds the derived subcontractorMinus to the nearest whole NOK", () => {
      const result = deriveDiscountSync({
        dnbDiscount: false,
        manualRabatt: "100",
        leggTil: "",
        subtotalExVat: 300,
        subcontractorBase: 200,
        isInitialSyncForExistingOrder: false,
      });

      // 200 * 100 / 300 = 66.666... -> rounds to 67
      expect(result).toEqual({ skip: false, rabatt: "100", subcontractorMinus: "67" });
    });
  });

  describe("DNB discount on", () => {
    it("computes rabatt from the DNB formula and a proportional subcontractorMinus", () => {
      const result = deriveDiscountSync({
        dnbDiscount: true,
        manualRabatt: "",
        leggTil: "",
        subtotalExVat: 1000,
        subcontractorBase: 500,
        isInitialSyncForExistingOrder: false,
      });

      // 20% of 1000 = 200 total discount; subcontractor share = 500 * 200/1000 = 100
      expect(result).toEqual({ skip: false, rabatt: "200", subcontractorMinus: "100" });
    });

    it("leaves subcontractorMinus untouched (not cleared) when the computed DNB discount is zero", () => {
      // Asymmetric with the manual-rabatt branch above on purpose: when DNB
      // computes a zero discount (e.g. totals not loaded yet), the original
      // component code never called setSubcontractorMinus at all in this
      // branch, so any existing value survives. `null` here signals "leave
      // it alone" to the caller, as opposed to "" which means "clear it".
      // If a future change makes this symmetric with the manual-rabatt
      // branch (clearing to ""), it would start wiping out real values
      // whenever an order with DNB already enabled reloads with a
      // momentarily-zero subtotal.
      const result = deriveDiscountSync({
        dnbDiscount: true,
        manualRabatt: "",
        leggTil: "",
        subtotalExVat: 0,
        subcontractorBase: 0,
        isInitialSyncForExistingOrder: false,
      });

      expect(result).toEqual({ skip: false, rabatt: "", subcontractorMinus: null });
    });

    it("accounts for an existing manual rabatt as the DNB baseline discount", () => {
      const result = deriveDiscountSync({
        dnbDiscount: true,
        manualRabatt: "100",
        leggTil: "",
        subtotalExVat: 1000,
        subcontractorBase: 500,
        isInitialSyncForExistingOrder: false,
      });

      // baseDiscount = 100; remainingTotal = 1000 - 100 = 900; dnb = round(900*0.2) = 180
      // totalDiscount = 100 + 180 = 280; subcontractor share = 500 * 280/1000 = 140
      expect(result).toEqual({ skip: false, rabatt: "280", subcontractorMinus: "140" });
    });

    it("folds a positive leggTil (extra charge) into the DNB discount base", () => {
      const result = deriveDiscountSync({
        dnbDiscount: true,
        manualRabatt: "",
        leggTil: "200",
        subtotalExVat: 1000,
        subcontractorBase: 500,
        isInitialSyncForExistingOrder: false,
      });

      // remainingTotal = 1000 - 0 + 200 = 1200; dnb = round(1200*0.2) = 240
      expect(result).toEqual({ skip: false, rabatt: "240", subcontractorMinus: "120" });
    });
  });
});

describe("calculateDnbDiscountAdjustment", () => {
  it("returns an empty discount text (not \"0\") when the computed discount is zero", () => {
    const result = calculateDnbDiscountAdjustment({
      subtotalExVat: 0,
      currentRabatt: "",
      currentLeggTil: "",
      previousDnbDiscount: 0,
    });

    expect(result).toEqual({ dnbDiscount: 0, totalDiscountText: "" });
  });

  it("formats a fractional discount to two decimal places", () => {
    const result = calculateDnbDiscountAdjustment({
      subtotalExVat: 333,
      currentRabatt: "",
      currentLeggTil: "",
      previousDnbDiscount: 0,
    });

    // round(333 * 0.2) = 67 -> integer, formatted without decimals
    expect(result.totalDiscountText).toBe("67");
  });
});
