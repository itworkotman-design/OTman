import { describe, expect, it } from "vitest";
import { createEmptyExtraPickup, normalizeExtraPickups, parseExtraPickups, readStoredExtraPickups } from "./extraPickups";

describe("createEmptyExtraPickup", () => {
  it("has no saved-address reference by default", () => {
    expect(createEmptyExtraPickup()).toEqual({
      address: "",
      phone: "",
      email: "",
      sendEmail: true,
      customPickupAddressId: null,
      customPickupAddressName: null,
      customPickupAddressPhone: null,
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
        customPickupAddressPhone: "Spoofed phone",
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
        customPickupAddressPhone: null,
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

describe("readStoredExtraPickups", () => {
  it("preserves a saved address's name and phone, unlike parseExtraPickups", () => {
    const stored = [
      {
        address: "Store 2",
        phone: "",
        email: "",
        sendEmail: true,
        customPickupAddressId: "cpa-1",
        customPickupAddressName: "Power Storo",
        customPickupAddressPhone: "22334455",
        latitude: 59.9,
        longitude: 10.7,
      },
    ];

    expect(readStoredExtraPickups(stored)).toEqual(stored);
  });

  it("returns an empty array for non-array or missing stored data", () => {
    expect(readStoredExtraPickups(null)).toEqual([]);
    expect(readStoredExtraPickups(undefined)).toEqual([]);
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
        customPickupAddressPhone: "22334455",
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
        customPickupAddressPhone: "22334455",
        latitude: 59.9,
        longitude: 10.7,
      },
    ]);
  });
});
