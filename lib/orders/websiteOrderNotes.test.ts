import { describe, expect, it } from "vitest";
import { buildWebsiteOrderNoteLines, buildWebsiteOrderTextFields } from "./websiteOrderNotes";

describe("buildWebsiteOrderTextFields", () => {
  it("puts the customer's comment in customerComments, not the description", () => {
    expect(
      buildWebsiteOrderTextFields({
        customerComment: "Ring på døra",
        noteLines: ["Picking up from: Store"],
        multiPickupLines: [],
      }),
    ).toEqual({ customerComments: "Ring på døra", description: "Picking up from: Store" });
  });

  it("separates the note lines from the multi-pickup lines with a blank line", () => {
    const { description } = buildWebsiteOrderTextFields({
      customerComment: null,
      noteLines: ["Picking up from: Store", "Store/business name: power"],
      multiPickupLines: ["Pickup location 1 (A)", "Pickup location 2 (B)"],
    });
    expect(description).toBe(
      "Picking up from: Store\nStore/business name: power\n\nPickup location 1 (A)\nPickup location 2 (B)",
    );
  });

  it("stores null for an empty comment or description", () => {
    expect(buildWebsiteOrderTextFields({ customerComment: null, noteLines: [], multiPickupLines: [] })).toEqual({
      customerComments: null,
      description: null,
    });
  });
});

const storePickup = {
  pickupSourceLabel: "Store",
  pickupPlaceName: "power",
  pickupContactName: null,
  pickupContactPhone: null,
  isStorePickup: true,
  pickupFloor: 0,
  pickupLiftAvailable: true,
  deliveryFloor: 5,
  deliveryLiftAvailable: false,
};

describe("buildWebsiteOrderNoteLines", () => {
  it("leaves out the delivery floor/lift when the order's floorNo/lift (sent to GSM) already say exactly that", () => {
    expect(buildWebsiteOrderNoteLines({ ...storePickup, orderFloorNo: "5", orderLift: "no" })).toEqual([
      "Picking up from: Store",
      "Store/business name: power",
    ]);
  });

  it("keeps the delivery floor when the stored floor is the pickup's instead", () => {
    const lines = buildWebsiteOrderNoteLines({
      ...storePickup,
      isStorePickup: false,
      pickupSourceLabel: "Private individual",
      pickupPlaceName: null,
      pickupFloor: -3,
      pickupLiftAvailable: false,
      deliveryFloor: 1,
      orderFloorNo: "-3",
      orderLift: "no",
    });
    expect(lines).toContain("Delivery floor: 1");
    expect(lines).toContain("Lift available at delivery: no");
    expect(lines).toContain("Pickup floor: -3");
  });

  it("keeps the delivery lift line when the stored lift doesn't match the delivery's", () => {
    const lines = buildWebsiteOrderNoteLines({
      ...storePickup,
      isStorePickup: false,
      pickupSourceLabel: "Private individual",
      pickupPlaceName: null,
      pickupFloor: 2,
      pickupLiftAvailable: false,
      deliveryFloor: 5,
      deliveryLiftAvailable: true,
      orderFloorNo: "5",
      orderLift: "no",
    });
    expect(lines).toContain("Lift available at delivery: yes");
  });

  it("lists the pickup contact and pickup floor/lift for a non-store pickup", () => {
    const lines = buildWebsiteOrderNoteLines({
      ...storePickup,
      isStorePickup: false,
      pickupSourceLabel: "Private individual",
      pickupPlaceName: null,
      pickupContactName: "Ola",
      pickupContactPhone: "12345678",
      pickupFloor: 2,
      pickupLiftAvailable: true,
      orderFloorNo: "5",
      orderLift: "no",
    });
    expect(lines).toEqual([
      "Picking up from: Private individual",
      "Pickup contact: Ola",
      "Pickup contact phone: 12345678",
      "Pickup floor: 2",
      "Lift available at pickup: yes",
    ]);
  });
});
