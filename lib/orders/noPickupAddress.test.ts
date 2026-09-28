import { describe, expect, it } from "vitest";
import {
  NO_PICKUP_ADDRESS_LABEL,
  isNoPickupAddress,
  resolvePickupForSubmit,
  restorePickupAfterUnlock,
} from "@/lib/orders/noPickupAddress";

describe("restorePickupAfterUnlock", () => {
  it("leaves a real pickup address alone", () => {
    expect(
      restorePickupAfterUnlock({ current: "Storo 1, Oslo", lastUnlocked: "Old 2, Oslo", customerAddress: "Cust 3, Oslo" }),
    ).toBe("Storo 1, Oslo");
  });

  it("restores the address the user had before the pickup was locked", () => {
    expect(
      restorePickupAfterUnlock({ current: NO_PICKUP_ADDRESS_LABEL, lastUnlocked: "Old 2, Oslo", customerAddress: "Cust 3, Oslo" }),
    ).toBe("Old 2, Oslo");
  });

  it("falls back to the customer's address when nothing was entered before the lock", () => {
    expect(
      restorePickupAfterUnlock({ current: NO_PICKUP_ADDRESS_LABEL, lastUnlocked: "", customerAddress: "Cust 3, Oslo" }),
    ).toBe("Cust 3, Oslo");
  });

  it("never restores the placeholder itself (order saved as install-only, then changed to a normal delivery)", () => {
    expect(
      restorePickupAfterUnlock({
        current: NO_PICKUP_ADDRESS_LABEL,
        lastUnlocked: NO_PICKUP_ADDRESS_LABEL,
        customerAddress: "Cust 3, Oslo",
      }),
    ).toBe("Cust 3, Oslo");
    expect(
      restorePickupAfterUnlock({ current: NO_PICKUP_ADDRESS_LABEL, lastUnlocked: NO_PICKUP_ADDRESS_LABEL, customerAddress: "" }),
    ).toBe("");
  });
});

describe("resolvePickupForSubmit", () => {
  const saved = {
    pickupAddress: "Storo Storsenter 1, 0587 Oslo",
    customPickupAddressId: "cpa-1",
    pickupLatitude: 59.945,
    pickupLongitude: 10.7669,
  };

  it("passes the pickup through untouched when it is not locked", () => {
    expect(resolvePickupForSubmit({ ...saved, locked: false })).toEqual(saved);
  });

  it("drops the saved location and coordinates when the pickup is locked", () => {
    expect(resolvePickupForSubmit({ ...saved, pickupAddress: NO_PICKUP_ADDRESS_LABEL, locked: true })).toEqual({
      pickupAddress: NO_PICKUP_ADDRESS_LABEL,
      customPickupAddressId: null,
      pickupLatitude: null,
      pickupLongitude: null,
    });
  });

  it("forces the placeholder when locked even if the address state is stale", () => {
    expect(resolvePickupForSubmit({ ...saved, locked: true }).pickupAddress).toBe(NO_PICKUP_ADDRESS_LABEL);
  });

  it("drops the saved location when the address was cleared", () => {
    expect(resolvePickupForSubmit({ ...saved, pickupAddress: "", locked: false })).toEqual({
      pickupAddress: "",
      customPickupAddressId: null,
      pickupLatitude: null,
      pickupLongitude: null,
    });
  });
});

describe("isNoPickupAddress", () => {
  it("treats blank and missing values as no pickup", () => {
    expect(isNoPickupAddress(null)).toBe(true);
    expect(isNoPickupAddress(undefined)).toBe(true);
    expect(isNoPickupAddress("")).toBe(true);
    expect(isNoPickupAddress("   ")).toBe(true);
  });

  it("treats the placeholder as no pickup regardless of case and padding", () => {
    expect(isNoPickupAddress(NO_PICKUP_ADDRESS_LABEL)).toBe(true);
    expect(isNoPickupAddress("  no shop pickup address ")).toBe(true);
  });

  it("treats a real address as a pickup", () => {
    expect(isNoPickupAddress("Storo Storsenter 1, 0587 Oslo")).toBe(false);
  });
});
