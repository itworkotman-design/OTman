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
