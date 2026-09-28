import { describe, expect, it } from "vitest";
import { shouldApplyCustomerPickup } from "@/lib/orders/customerPickupSync";

describe("shouldApplyCustomerPickup", () => {
  it("applies the customer's address on a deliberate customer switch, even over a hand-entered pickup", () => {
    expect(
      shouldApplyCustomerPickup({ isInitialSync: false, hasUserEditedPickup: true, customerAddress: "Storo 1, Oslo" }),
    ).toBe(true);
  });

  it("keeps a pickup the user entered while the customer list was still loading", () => {
    expect(
      shouldApplyCustomerPickup({ isInitialSync: true, hasUserEditedPickup: true, customerAddress: "Storo 1, Oslo" }),
    ).toBe(false);
  });

  it("fills in the customer's address on the initial sync when the user hasn't typed one", () => {
    expect(
      shouldApplyCustomerPickup({ isInitialSync: true, hasUserEditedPickup: false, customerAddress: "Storo 1, Oslo" }),
    ).toBe(true);
  });

  it("never blanks a pickup the user entered by hand when the customer has no address", () => {
    expect(
      shouldApplyCustomerPickup({ isInitialSync: false, hasUserEditedPickup: true, customerAddress: "" }),
    ).toBe(false);
    expect(
      shouldApplyCustomerPickup({ isInitialSync: false, hasUserEditedPickup: true, customerAddress: "   " }),
    ).toBe(false);
  });

  it("clears an auto-filled default when switching to a customer without an address", () => {
    expect(
      shouldApplyCustomerPickup({ isInitialSync: false, hasUserEditedPickup: false, customerAddress: "" }),
    ).toBe(true);
  });
});
