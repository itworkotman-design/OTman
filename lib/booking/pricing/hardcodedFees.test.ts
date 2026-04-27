import { describe, expect, it } from "vitest";

import { calculateExtraWorkFee } from "./hardcodedFees";

describe("calculateExtraWorkFee", () => {
  it("charges 150 NOK per started 20 minute block", () => {
    expect(calculateExtraWorkFee(0)).toEqual({ blocks: 0, price: 0 });
    expect(calculateExtraWorkFee(20)).toEqual({ blocks: 1, price: 150 });
    expect(calculateExtraWorkFee(25)).toEqual({ blocks: 2, price: 300 });
    expect(calculateExtraWorkFee(40)).toEqual({ blocks: 2, price: 300 });
    expect(calculateExtraWorkFee(41)).toEqual({ blocks: 3, price: 450 });
    expect(calculateExtraWorkFee(61)).toEqual({ blocks: 4, price: 600 });
  });
});
