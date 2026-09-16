import { describe, expect, it } from "vitest";
import { createEmptyExtraPickup, normalizeExtraPickups, parseExtraPickups } from "./extraPickups";

describe("createEmptyExtraPickup", () => {
  it("has no saved-address reference by default", () => {
    expect(createEmptyExtraPickup()).toEqual({
      address: "",
      phone: "",
      email: "",
      sendEmail: true,
      customPickupAddressId: null,
      customPickupAddressName: null,
      latitude: null,
      longitude: null,
    });
  });
});

describe("parseExtraPickups", () => {
  it("keeps a submitted customPickupAddressId but never trusts a client-submitted name/coordinates", () => {
    const result = parseExtraPickups([
      {
        address: "Store 2",
        phone: "",
        email: "",
        sendEmail: true,
        customPickupAddressId: "cpa-1",
        customPickupAddressName: "Spoofed name",
        latitude: 1,
        longitude: 1,
      },
    ]);

    expect(result).toEqual([
      {
        address: "Store 2",
        phone: "",
        email: "",
        sendEmail: true,
        customPickupAddressId: "cpa-1",
        customPickupAddressName: null,
        latitude: null,
        longitude: null,
      },
    ]);
  });

  it("defaults customPickupAddressId to null when absent or blank", () => {
    const result = parseExtraPickups([
      { address: "Store 2" },
      { address: "Store 3", customPickupAddressId: "   " },
    ]);

    expect(result.map((pickup) => pickup.customPickupAddressId)).toEqual([null, null]);
  });

  it("keeps a manually-entered pickup's own submitted coordinates when there is no saved-address id", () => {
    const result = parseExtraPickups([
      { address: "Store 2", latitude: 59.9, longitude: 10.7 },
    ]);

    expect(result[0].latitude).toBe(59.9);
    expect(result[0].longitude).toBe(10.7);
  });

  it("drops out-of-range or non-numeric manually-submitted coordinates", () => {
    const result = parseExtraPickups([
      { address: "Store 2", latitude: 200, longitude: "not a number" },
    ]);

    expect(result[0].latitude).toBeNull();
    expect(result[0].longitude).toBeNull();
  });
});

describe("normalizeExtraPickups", () => {
  it("passes the saved-address fields through unchanged", () => {
    const result = normalizeExtraPickups([
      {
        address: " Store 2 ",
        phone: "",
        email: "",
        sendEmail: true,
        customPickupAddressId: "cpa-1",
        customPickupAddressName: "Power Storo",
        latitude: 59.9,
        longitude: 10.7,
      },
    ]);

    expect(result).toEqual([
      {
        address: "Store 2",
        phone: "",
        email: "",
        sendEmail: true,
        customPickupAddressId: "cpa-1",
        customPickupAddressName: "Power Storo",
        latitude: 59.9,
        longitude: 10.7,
      },
    ]);
  });
});
