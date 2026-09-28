import { describe, expect, it } from "vitest";
import { resolveReturnForSubmit } from "@/lib/orders/resolveReturnForSubmit";

describe("resolveReturnForSubmit", () => {
  const saved = {
    returnAddress: "Retur Storo, 0587 Oslo",
    customReturnAddressId: "cra-1",
    returnLatitude: 59.9,
    returnLongitude: 10.7,
  };

  it("passes the return address through while the return section is shown", () => {
    expect(resolveReturnForSubmit({ ...saved, shown: true })).toEqual(saved);
  });

  it("sends no return address, saved location or coordinates when the section is hidden", () => {
    expect(resolveReturnForSubmit({ ...saved, shown: false })).toEqual({
      returnAddress: "",
      customReturnAddressId: null,
      returnLatitude: null,
      returnLongitude: null,
    });
  });

  it("drops the saved location and coordinates when the address is blank", () => {
    expect(resolveReturnForSubmit({ ...saved, returnAddress: "  ", shown: true })).toEqual({
      returnAddress: "  ",
      customReturnAddressId: null,
      returnLatitude: null,
      returnLongitude: null,
    });
  });
});
