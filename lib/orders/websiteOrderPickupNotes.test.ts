import { describe, expect, it } from "vitest";
import { buildPickupNoteLines, type PickupNoteStop } from "./websiteOrderNotes";

const stop = (overrides: Partial<PickupNoteStop>): PickupNoteStop => ({
  source: "store",
  placeName: null,
  address: null,
  floor: 0,
  liftAvailable: false,
  contactName: null,
  contactPhone: null,
  productNames: [],
  ...overrides,
});

const delivery = { deliveryFloor: 5, deliveryLiftAvailable: false, orderFloorNo: "5", orderLift: "no" as const };

describe("buildPickupNoteLines", () => {
  it("writes one line per pickup stop, with its type, name, address and products", () => {
    const lines = buildPickupNoteLines({
      ...delivery,
      stops: [
        stop({ placeName: "power", address: "Smalvollveien 65, 0667 Oslo, Norge", productNames: ["Mikrobølgeovn", "Vinkjøleskap #1"] }),
        stop({ placeName: "power", address: "Trøgstadveien 4, 1830 Askim, Norge", productNames: ["Vinkjøleskap #2", "Vinkjøleskap #3"] }),
        stop({
          source: "private",
          address: "Eivind Olsens vei, 3016 Drammen, Norge",
          floor: 10,
          liftAvailable: false,
          contactName: "troll",
          contactPhone: "00000000",
          productNames: ["Kommode", "Halvpall", "Pall"],
        }),
      ],
    });

    expect(lines.join("\n")).toBe(
      [
        "Pickup 1 - Store: Power (Smalvollveien 65, 0667 Oslo, Norge) - picking up: Mikrobølgeovn, Vinkjøleskap #1",
        "",
        "Pickup 2 - Store: Power (Trøgstadveien 4, 1830 Askim, Norge) - picking up: Vinkjøleskap #2, Vinkjøleskap #3",
        "",
        "Pickup 3 - Private: Troll / 00000000 (Eivind Olsens vei, 3016 Drammen, Norge) - picking up: Kommode, Halvpall, Pall",
        "    *floor 10, no lift",
      ].join("\n"),
    );
  });

  it("leaves out what isn't known, and the product list when everything comes from one stop", () => {
    expect(buildPickupNoteLines({ ...delivery, stops: [stop({ source: null, address: "Storgata 1" })] })).toEqual([
      "Pickup 1 (Storgata 1)",
    ]);
    expect(buildPickupNoteLines({ ...delivery, stops: [stop({ address: "Storgata 1" })] })).toEqual([
      "Pickup 1 - Store (Storgata 1)",
    ]);
  });

  it("names a business by its name and contact, with its floor", () => {
    expect(
      buildPickupNoteLines({
        ...delivery,
        stops: [
          stop({
            source: "business",
            placeName: "Acme AS",
            address: "Industriveien 2",
            floor: 2,
            liftAvailable: true,
            contactName: "Kari",
            contactPhone: "87654321",
          }),
        ],
      }),
    ).toEqual(["Pickup 1 - Business: Acme AS, Kari / 87654321 (Industriveien 2)", "    *floor 2, lift"]);
  });

  it("never gives a store a floor", () => {
    expect(buildPickupNoteLines({ ...delivery, stops: [stop({ address: "A", floor: 4 })] })).toEqual(["Pickup 1 - Store (A)"]);
  });

  it("adds the delivery floor/lift only when the order's floor/lift (sent to GSM) don't already say it", () => {
    const stops = [stop({ address: "A" })];
    expect(buildPickupNoteLines({ ...delivery, stops })).toEqual(["Pickup 1 - Store (A)"]);
    expect(buildPickupNoteLines({ ...delivery, orderFloorNo: "10", stops })).toEqual([
      "Pickup 1 - Store (A)",
      "",
      "Delivery",
      "    *floor 5, no lift",
    ]);
  });
});
