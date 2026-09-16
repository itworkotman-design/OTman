import { describe, expect, it } from "vitest";
import { validateCustomPickupAddressInput } from "./validateInput";

describe("validateCustomPickupAddressInput", () => {
  it("accepts a well-formed input", () => {
    const result = validateCustomPickupAddressInput({
      name: "Power Storo",
      address: "Storo Storsenter 1, 0587 Oslo",
      latitude: 59.945,
      longitude: 10.7669,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Power Storo",
        address: "Storo Storsenter 1, 0587 Oslo",
        latitude: 59.945,
        longitude: 10.7669,
      },
    });
  });

  it("rejects a missing name", () => {
    const result = validateCustomPickupAddressInput({
      address: "Some address",
      latitude: 10,
      longitude: 10,
    });

    expect(result).toEqual({
      ok: false,
      error: { reason: "NAME_REQUIRED", message: expect.any(String) },
    });
  });

  it("rejects a missing address", () => {
    const result = validateCustomPickupAddressInput({
      name: "Power Storo",
      latitude: 10,
      longitude: 10,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe("ADDRESS_REQUIRED");
  });

  it.each([
    ["out-of-range positive", 91, 10],
    ["out-of-range negative", -91, 10],
    ["non-numeric", "abc", 10],
    ["missing", undefined, 10],
  ])("rejects an invalid latitude (%s)", (_label, latitude, longitude) => {
    const result = validateCustomPickupAddressInput({
      name: "Power Storo",
      address: "Some address",
      latitude,
      longitude,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe("INVALID_LATITUDE");
  });

  it.each([
    ["out-of-range positive", 10, 181],
    ["out-of-range negative", 10, -181],
    ["non-numeric", 10, "xyz"],
    ["missing", 10, undefined],
  ])("rejects an invalid longitude (%s)", (_label, latitude, longitude) => {
    const result = validateCustomPickupAddressInput({
      name: "Power Storo",
      address: "Some address",
      latitude,
      longitude,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe("INVALID_LONGITUDE");
  });

  it("accepts boundary values -90/-180 and 90/180", () => {
    expect(
      validateCustomPickupAddressInput({
        name: "A",
        address: "B",
        latitude: -90,
        longitude: -180,
      }).ok,
    ).toBe(true);

    expect(
      validateCustomPickupAddressInput({
        name: "A",
        address: "B",
        latitude: 90,
        longitude: 180,
      }).ok,
    ).toBe(true);
  });

  it("rejects a non-object body", () => {
    const result = validateCustomPickupAddressInput(null);
    expect(result.ok).toBe(false);
  });
});
