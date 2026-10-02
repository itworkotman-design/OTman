import { describe, expect, it } from "vitest";
import {
  buildMultiPickupDescriptionLines,
  extraPickupFloorsForPricing,
  parseExtraPickupLocations,
} from "./websiteExtraPickupLocations";

describe("parseExtraPickupLocations", () => {
  it("returns nothing for a non-array or empty input", () => {
    expect(parseExtraPickupLocations(undefined)).toEqual([]);
    expect(parseExtraPickupLocations(null)).toEqual([]);
    expect(parseExtraPickupLocations([])).toEqual([]);
  });

  it("parses a well-formed entry", () => {
    const result = parseExtraPickupLocations([
      {
        source: "business",
        placeName: "Acme AS",
        address: "Storgata 3, Oslo",
        floor: 2,
        liftAvailable: true,
        contactName: "Kari Nordmann",
        contactPhone: "+47 987 65 432",
        productNames: ["Sofa", "Bed"],
      },
    ]);

    expect(result).toEqual([
      {
        source: "business",
        placeName: "Acme AS",
        address: "Storgata 3, Oslo",
        floor: 2,
        liftAvailable: true,
        contactName: "Kari Nordmann",
        contactPhone: "+47 987 65 432",
        productNames: ["Sofa", "Bed"],
      },
    ]);
  });

  it("keeps a basement (negative) floor", () => {
    const [loc] = parseExtraPickupLocations([{ address: "Somewhere 1", floor: -1 }]);
    expect(loc.floor).toBe(-1);
  });

  it("drops an entry with no usable address", () => {
    expect(parseExtraPickupLocations([{ address: "" }, { address: "   " }, {}])).toEqual([]);
  });

  it("normalizes an unrecognized pickup source to null rather than trusting arbitrary input", () => {
    const [loc] = parseExtraPickupLocations([{ address: "Somewhere 1", source: "warehouse" }]);
    expect(loc.source).toBeNull();
  });

  it("filters out non-string / blank product names and defaults missing fields safely", () => {
    const [loc] = parseExtraPickupLocations([{ address: "Somewhere 1", productNames: ["Sofa", "", 5, "  ", "Bed"] }]);
    expect(loc.productNames).toEqual(["Sofa", "Bed"]);
    expect(loc.floor).toBe(0);
    expect(loc.liftAvailable).toBe(false);
    expect(loc.placeName).toBeNull();
    expect(loc.contactName).toBeNull();
    expect(loc.contactPhone).toBeNull();
  });

  it("ignores malformed entries in the array instead of throwing", () => {
    expect(parseExtraPickupLocations(["not an object", 5, null])).toEqual([]);
  });
});

describe("buildMultiPickupDescriptionLines", () => {
  it("returns nothing when there's just one pickup location and nothing was split", () => {
    const lines = buildMultiPickupDescriptionLines({
      firstLocationAddress: "Storgata 1, Oslo",
      firstLocationProductNames: [],
      extraLocations: [],
    });
    expect(lines).toEqual([]);
  });

  it("describes the first location once it was given its own product split", () => {
    const lines = buildMultiPickupDescriptionLines({
      firstLocationAddress: "Storgata 1, Oslo",
      firstLocationProductNames: ["Washing machine"],
      extraLocations: [],
    });
    expect(lines).toEqual(["Pickup location 1 (Storgata 1, Oslo) — picking up: Washing machine"]);
  });

  it("describes every extra location with its source, contact and claimed products", () => {
    const lines = buildMultiPickupDescriptionLines({
      firstLocationAddress: "Storgata 1, Oslo",
      firstLocationProductNames: ["Washing machine"],
      extraLocations: [
        {
          source: "business",
          placeName: "Acme AS",
          address: "Storgata 3, Oslo",
          floor: 0,
          liftAvailable: false,
          contactName: "Kari Nordmann",
          contactPhone: "+47 987 65 432",
          productNames: ["Sofa", "Bed"],
        },
        {
          source: null,
          placeName: null,
          address: "Storgata 5, Oslo",
          floor: 0,
          liftAvailable: false,
          contactName: null,
          contactPhone: null,
          productNames: [],
        },
      ],
    });

    expect(lines).toEqual([
      "Pickup location 1 (Storgata 1, Oslo) — picking up: Washing machine",
      "Pickup location 2 (Storgata 3, Oslo, Business, Acme AS, contact: Kari Nordmann / +47 987 65 432) — picking up: Sofa, Bed",
      "Pickup location 3 (Storgata 5, Oslo)",
    ]);
  });
});

describe("extraPickupFloorsForPricing", () => {
  it("passes each extra stop's floor and lift through for the floor surcharge", () => {
    const locations = parseExtraPickupLocations([
      { address: "A 1", source: "private", floor: 5, liftAvailable: false },
      { address: "B 2", source: "business", floor: -2, liftAvailable: true },
    ]);
    expect(extraPickupFloorsForPricing(locations)).toEqual([
      { floor: 5, liftAvailable: false },
      { floor: -2, liftAvailable: true },
    ]);
  });

  it("treats a store stop as ground floor with a lift, whatever the client sent", () => {
    const locations = parseExtraPickupLocations([{ address: "A 1", source: "store", floor: 7, liftAvailable: false }]);
    expect(extraPickupFloorsForPricing(locations)).toEqual([{ floor: 0, liftAvailable: true }]);
  });
});

describe("buildMultiPickupDescriptionLines — floors", () => {
  const base = {
    source: "private",
    placeName: null,
    address: "Storgata 3, Oslo",
    floor: 4,
    liftAvailable: false,
    contactName: null,
    contactPhone: null,
    productNames: ["Sofa"],
  };

  it("tells the driver an extra stop's floor and lift", () => {
    const [, line] = buildMultiPickupDescriptionLines({
      firstLocationAddress: "Storgata 1, Oslo",
      firstLocationProductNames: ["Washing machine"],
      extraLocations: [base, { ...base, address: "Kjellerveien 1", floor: -1, liftAvailable: true }],
    });
    expect(line).toBe("Pickup location 2 (Storgata 3, Oslo, Private individual, floor 4, no lift) — picking up: Sofa");

    const lines = buildMultiPickupDescriptionLines({
      firstLocationAddress: "Storgata 1, Oslo",
      firstLocationProductNames: ["Washing machine"],
      extraLocations: [{ ...base, address: "Kjellerveien 1", floor: -1, liftAvailable: true }],
    });
    expect(lines[1]).toContain("floor -1, lift");
  });

  it("leaves floor and lift out for a store stop", () => {
    const [, line] = buildMultiPickupDescriptionLines({
      firstLocationAddress: "Storgata 1, Oslo",
      firstLocationProductNames: ["Washing machine"],
      extraLocations: [{ ...base, source: "store", placeName: "Power", floor: 0 }],
    });
    expect(line).not.toContain("floor");
    expect(line).not.toContain("lift");
  });
});
