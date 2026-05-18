import { describe, expect, it } from "vitest";
import { calculateCurrentTotalsWithFrozenExternalLines, frozenOrderTotalsDiffer } from "./frozenOrderPricing";

describe("frozen order pricing", () => {
  it("preserves imported KM or custom deltas when comparing current catalog prices", () => {
    const current = calculateCurrentTotalsWithFrozenExternalLines({
      stored: {
        totalExVat: 1468,
        subcontractorTotal: 919,
      },
      snapshotCalculated: {
        totalExVat: 969,
        subcontractorTotal: 919,
      },
      currentCatalogCalculated: {
        totalExVat: 919,
        subcontractorTotal: 869,
      },
    });

    expect(current).toEqual({
      totalExVat: 1418,
      subcontractorTotal: 869,
    });
    expect(
      frozenOrderTotalsDiffer(
        {
          totalExVat: 1468,
          subcontractorTotal: 919,
        },
        current,
      ),
    ).toBe(true);
  });
});
