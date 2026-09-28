import { describe, expect, it } from "vitest";
import { findForbiddenAddressRemoval, isPickupLockedForCards } from "@/lib/orders/addressRemovalAccess";

describe("isPickupLockedForCards", () => {
  it("is locked only when every card is install-only or return-only", () => {
    expect(isPickupLockedForCards([{ deliveryType: "INSTALL_ONLY" }, { deliveryType: "RETURN_ONLY" }])).toBe(true);
    expect(isPickupLockedForCards([{ deliveryType: "INSTALL_ONLY" }, { deliveryType: "INDOOR" }])).toBe(false);
    expect(isPickupLockedForCards([])).toBe(false);
  });
});

describe("findForbiddenAddressRemoval", () => {
  const base = { isAdmin: false, pickupLocked: false };

  it("never blocks an admin", () => {
    expect(
      findForbiddenAddressRemoval({ ...base, isAdmin: true, submitted: { pickupAddress: "", deliveryAddress: "" } }),
    ).toBeNull();
  });

  it("blocks a non-admin from submitting a blank pickup or delivery address", () => {
    expect(findForbiddenAddressRemoval({ ...base, submitted: { pickupAddress: "  ", deliveryAddress: "x" } })).toBe(
      "pickupAddress",
    );
    expect(findForbiddenAddressRemoval({ ...base, submitted: { pickupAddress: "x", deliveryAddress: "" } })).toBe(
      "deliveryAddress",
    );
  });

  it("blocks a non-admin from removing a pickup via the placeholder unless the pickup is locked", () => {
    const submitted = { pickupAddress: "No shop pickup address", deliveryAddress: "x" };

    expect(findForbiddenAddressRemoval({ ...base, submitted })).toBe("pickupAddress");
    expect(findForbiddenAddressRemoval({ ...base, pickupLocked: true, submitted })).toBeNull();
  });

  it("ignores fields the request doesn't mention", () => {
    expect(findForbiddenAddressRemoval({ ...base, submitted: {} })).toBeNull();
  });

  it("on an update, only blocks when the stored order actually had that address", () => {
    const submitted = { pickupAddress: "", deliveryAddress: "" };

    expect(
      findForbiddenAddressRemoval({
        ...base,
        submitted,
        existing: { pickupAddress: "Storo 1, Oslo", deliveryAddress: null },
      }),
    ).toBe("pickupAddress");
    expect(
      findForbiddenAddressRemoval({
        ...base,
        submitted,
        existing: { pickupAddress: null, deliveryAddress: "Delivery 1" },
      }),
    ).toBe("deliveryAddress");
    expect(
      findForbiddenAddressRemoval({ ...base, submitted, existing: { pickupAddress: "No shop pickup address", deliveryAddress: "" } }),
    ).toBeNull();
  });
});
