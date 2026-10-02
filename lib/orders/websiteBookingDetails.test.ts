import { describe, expect, it } from "vitest";
import { parseExtraPickupLocations } from "./websiteExtraPickupLocations";
import {
  buildWhiteGoodsBookingDetails,
  parseWhiteGoodsBookingDetails,
  type WhiteGoodsBookingDetailsInput,
} from "./websiteBookingDetails";

const input: WhiteGoodsBookingDetailsInput = {
  customerType: "private",
  firstPickup: {
    source: "private",
    placeName: null,
    address: "Storgata 1, Oslo",
    floor: 3,
    liftAvailable: false,
    contactName: "Ola",
    contactPhone: "12345678",
    productNames: [],
  },
  extraPickups: [],
  delivery: { address: "Kirkegata 5, Oslo", floor: -1, liftAvailable: true },
  preferredDate: "2026-10-05",
  timeWindow: "08:00-16:00",
  drivingDistance: "21",
  orderExtras: [{ label: "Etasjetillegg", price: 142.42, qty: 2 }],
};

describe("buildWhiteGoodsBookingDetails", () => {
  it("captures a single-pickup order", () => {
    expect(buildWhiteGoodsBookingDetails(input)).toEqual({
      version: 1,
      customerType: "private",
      pickups: [
        {
          source: "private",
          placeName: "",
          address: "Storgata 1, Oslo",
          floor: 3,
          liftAvailable: false,
          contactName: "Ola",
          contactPhone: "12345678",
        },
      ],
      delivery: { address: "Kirkegata 5, Oslo", floor: -1, liftAvailable: true },
      preferredDate: "2026-10-05",
      timeWindow: "08:00-16:00",
      drivingDistance: "21",
      orderExtras: [{ label: "Etasjetillegg", price: 142.42, qty: 2 }],
    });
  });

  it("gives a store pickup no floor and no lift, whatever was sent", () => {
    const details = buildWhiteGoodsBookingDetails({
      ...input,
      firstPickup: { ...input.firstPickup, source: "store", placeName: "Elkjøp", floor: 4, liftAvailable: false },
    });
    expect(details.pickups[0]).toMatchObject({ source: "store", placeName: "Elkjøp", floor: null, liftAvailable: false });
  });

  it("lists every extra stop with the products it collects once the order is split", () => {
    const details = buildWhiteGoodsBookingDetails({
      ...input,
      firstPickup: { ...input.firstPickup, productNames: ["Vaskemaskin"] },
      extraPickups: parseExtraPickupLocations([
        {
          source: "business",
          placeName: "Acme AS",
          address: "Industriveien 2",
          floor: 2,
          liftAvailable: true,
          contactName: "Kari",
          contactPhone: "87654321",
          productNames: ["Sofa"],
        },
        { source: "store", placeName: "Power", address: "Strømmen 1", floor: 5, productNames: ["TV"] },
      ]),
    });

    expect(details.pickups).toHaveLength(3);
    expect(details.pickups[0].productNames).toEqual(["Vaskemaskin"]);
    expect(details.pickups[1]).toEqual({
      source: "business",
      placeName: "Acme AS",
      address: "Industriveien 2",
      floor: 2,
      liftAvailable: true,
      contactName: "Kari",
      contactPhone: "87654321",
      productNames: ["Sofa"],
    });
    expect(details.pickups[2]).toMatchObject({ source: "store", floor: null, productNames: ["TV"] });
  });

  it("stores floor 0 (not given) as no floor", () => {
    const details = buildWhiteGoodsBookingDetails({ ...input, delivery: { ...input.delivery, floor: 0 } });
    expect(details.delivery.floor).toBeNull();
  });

  it("keeps only a recognised customer type", () => {
    expect(buildWhiteGoodsBookingDetails({ ...input, customerType: "business" }).customerType).toBe("business");
    expect(buildWhiteGoodsBookingDetails({ ...input, customerType: "company" }).customerType).toBeNull();
    expect(buildWhiteGoodsBookingDetails({ ...input, customerType: undefined }).customerType).toBeNull();
  });
});

describe("parseWhiteGoodsBookingDetails", () => {
  it("round-trips what the builder produces (as stored JSON)", () => {
    const details = buildWhiteGoodsBookingDetails({
      ...input,
      firstPickup: { ...input.firstPickup, productNames: ["Vaskemaskin"] },
    });
    expect(parseWhiteGoodsBookingDetails(JSON.parse(JSON.stringify(details)))).toEqual(details);
  });

  it("returns null for anything that isn't version-1 details", () => {
    expect(parseWhiteGoodsBookingDetails(null)).toBeNull();
    expect(parseWhiteGoodsBookingDetails("text")).toBeNull();
    expect(parseWhiteGoodsBookingDetails({})).toBeNull();
    expect(parseWhiteGoodsBookingDetails({ ...buildWhiteGoodsBookingDetails(input), version: 2 })).toBeNull();
    expect(parseWhiteGoodsBookingDetails({ ...buildWhiteGoodsBookingDetails(input), pickups: "x" })).toBeNull();
    expect(parseWhiteGoodsBookingDetails({ ...buildWhiteGoodsBookingDetails(input), delivery: null })).toBeNull();
  });

  it("coerces malformed fields inside a stop to safe defaults", () => {
    const parsed = parseWhiteGoodsBookingDetails({
      ...buildWhiteGoodsBookingDetails(input),
      pickups: [{ source: "warehouse", address: 5, floor: "x", liftAvailable: "yes", productNames: ["A", 3] }],
    });
    expect(parsed?.pickups[0]).toEqual({
      source: null,
      placeName: "",
      address: "",
      floor: null,
      liftAvailable: false,
      contactName: "",
      contactPhone: "",
      productNames: ["A"],
    });
  });
});

describe("order extras", () => {
  it("drops malformed order-extra lines when reading back", () => {
    const parsed = parseWhiteGoodsBookingDetails({
      ...buildWhiteGoodsBookingDetails(input),
      orderExtras: [{ label: "Ekstra henting", price: 300, qty: 1 }, { label: 5 }, null, { label: "x", price: "1", qty: 1 }],
    });
    expect(parsed?.orderExtras).toEqual([{ label: "Ekstra henting", price: 300, qty: 1 }]);
  });

  it("reads a missing order-extras list as empty", () => {
    const { orderExtras: _omit, ...rest } = buildWhiteGoodsBookingDetails(input);
    void _omit;
    expect(parseWhiteGoodsBookingDetails(rest)?.orderExtras).toEqual([]);
  });
});
