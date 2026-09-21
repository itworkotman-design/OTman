import { describe, expect, it } from "vitest";
import { resolveDefaultReturnAddress } from "./defaultReturnAddress";

const mainReturn = { id: "ret-1", name: "Gjenvinning Alna", address: "Alna 1, Oslo", latitude: 59.93, longitude: 10.85 };
const mainPickup = { id: "cpa-1", name: "Power Storo", address: "Storo 1", latitude: 59.9, longitude: 10.7 };

describe("resolveDefaultReturnAddress", () => {
  it("uses the main return address when Retur til gjenvinning is selected", () => {
    expect(
      resolveDefaultReturnAddress({
        selectedReturnOptionCodes: ["RETURNREC"],
        mainReturnAddress: mainReturn,
        mainPickupAddress: mainPickup,
        customerAddress: "Storo 1",
      }),
    ).toEqual({ address: "Alna 1, Oslo", customAddressId: "ret-1" });
  });

  it("keeps the store's own address for Retur til butikk", () => {
    expect(
      resolveDefaultReturnAddress({
        selectedReturnOptionCodes: ["RETURNSTORE"],
        mainReturnAddress: mainReturn,
        mainPickupAddress: mainPickup,
        customerAddress: "Storo 1",
      }),
    ).toEqual({ address: "Storo 1", customAddressId: "cpa-1" });
  });

  it("uses the main return when any card selects gjenvinning", () => {
    expect(
      resolveDefaultReturnAddress({
        selectedReturnOptionCodes: ["RETURNSTORE", "RETURNREC"],
        mainReturnAddress: mainReturn,
        mainPickupAddress: mainPickup,
        customerAddress: "Storo 1",
      }).customAddressId,
    ).toBe("ret-1");
  });

  it("falls back to the customer's address when gjenvinning is selected but no main return is set", () => {
    expect(
      resolveDefaultReturnAddress({
        selectedReturnOptionCodes: ["RETURNREC"],
        mainReturnAddress: null,
        mainPickupAddress: null,
        customerAddress: "Some street 1",
      }),
    ).toEqual({ address: "Some street 1", customAddressId: null });
  });
});
