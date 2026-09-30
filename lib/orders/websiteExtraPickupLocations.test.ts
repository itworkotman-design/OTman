import { describe, expect, it } from "vitest";
import { buildMultiPickupDescriptionLines, parseExtraPickupLocations } from "./websiteExtraPickupLocations";

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
