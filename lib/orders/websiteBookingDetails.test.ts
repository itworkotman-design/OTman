import { describe, expect, it } from "vitest";
import { parseExtraPickupLocations } from "./websiteExtraPickupLocations";
import {
  buildWhiteGoodsBookingDetails,
  parseWhiteGoodsBookingDetails,
  withLiveOrderFields,
  floorPricingInputs,
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

  it("records which product cards each stop collects", () => {
    const details = buildWhiteGoodsBookingDetails({
      ...input,
      firstPickup: { ...input.firstPickup, productNames: ["Vaskemaskin #1"], cardIds: [0] },
      extraPickups: parseExtraPickupLocations([
        { source: "store", placeName: "Elkjøp", address: "Askim", productNames: ["Vaskemaskin #2"], cardIds: [1, "x"] },
      ]),
    });
    expect(details.pickups.map((stop) => stop.cardIds)).toEqual([[0], [1]]);
    const stored = parseWhiteGoodsBookingDetails(JSON.parse(JSON.stringify(details)));
    expect(stored?.pickups.map((stop) => stop.cardIds)).toEqual([[0], [1]]);
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

  it("keeps the total the customer was shown at booking, and only a real number", () => {
    const stored = JSON.parse(JSON.stringify(buildWhiteGoodsBookingDetails({ ...input, shownTotal: 13450 })));
    expect(parseWhiteGoodsBookingDetails(stored)?.shownTotal).toBe(13450);
    expect(parseWhiteGoodsBookingDetails({ ...stored, shownTotal: "13450" })?.shownTotal).toBeUndefined();
    expect(parseWhiteGoodsBookingDetails(JSON.parse(JSON.stringify(buildWhiteGoodsBookingDetails(input))))?.shownTotal).toBeUndefined();
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

describe("withLiveOrderFields", () => {
  const details = buildWhiteGoodsBookingDetails({
    ...input,
    extraPickups: parseExtraPickupLocations([{ address: "Industriveien 2", source: "business", floor: 2 }]),
  });
  const live = {
    pickupAddress: "Storgata 1, Oslo",
    deliveryAddress: "Kirkegata 5, Oslo",
    extraPickupAddress: ["Industriveien 2"],
    deliveryDate: "2026-10-05",
    timeWindow: "08:00-16:00",
    drivingDistance: "21",
  };

  it("shows the order's current addresses, date, time window and distance after an admin edit", () => {
    const next = withLiveOrderFields(details, {
      ...live,
      pickupAddress: "Ny gate 1",
      deliveryAddress: "Ny gate 2",
      extraPickupAddress: ["Ny gate 3"],
      deliveryDate: "2026-10-09",
      timeWindow: "10:00-16:00",
      drivingDistance: "30",
    });
    expect(next.pickups.map((p) => p.address)).toEqual(["Ny gate 1", "Ny gate 3"]);
    expect(next.delivery.address).toBe("Ny gate 2");
    expect(next).toMatchObject({ preferredDate: "2026-10-09", timeWindow: "10:00-16:00", drivingDistance: "30" });
    // Everything the order columns can't say stays as booked.
    expect(next.pickups[1]).toMatchObject({ source: "business", floor: 2 });
  });

  it("keeps the booked extra-stop addresses when the stop count no longer lines up", () => {
    const next = withLiveOrderFields(details, { ...live, extraPickupAddress: ["A", "B"] });
    expect(next.pickups[1].address).toBe("Industriveien 2");
  });

  it("keeps booked values where the order column is empty", () => {
    const next = withLiveOrderFields(details, { ...live, deliveryAddress: null, deliveryDate: "", timeWindow: null });
    expect(next.delivery.address).toBe("Kirkegata 5, Oslo");
    expect(next.preferredDate).toBe("2026-10-05");
    expect(next.timeWindow).toBe("08:00-16:00");
  });
});

describe("floorPricingInputs", () => {
  it("prices every stop from the booked details: store pickup at ground with a lift", () => {
    const details = buildWhiteGoodsBookingDetails({
      ...input,
      firstPickup: { ...input.firstPickup, source: "store", floor: 0 },
      delivery: { address: "Kirkegata 5", floor: 5, liftAvailable: false },
      extraPickups: parseExtraPickupLocations([
        { address: "A 1", source: "private", floor: -3, liftAvailable: false },
        { address: "B 2", source: "store" },
      ]),
    });

    expect(floorPricingInputs({ floorNo: "5", lift: "no", websiteBookingDetails: details })).toEqual({
      pickupFloor: 0,
      pickupLiftAvailable: true,
      deliveryFloor: 5,
      deliveryLiftAvailable: false,
      extraPickupFloors: [
        { floor: -3, liftAvailable: false },
        { floor: 0, liftAvailable: true },
      ],
    });
  });

  it("uses a private first pickup's own floor and lift", () => {
    const details = buildWhiteGoodsBookingDetails(input); // private, floor 3, no lift; delivery -1 with lift
    expect(floorPricingInputs({ floorNo: "3", lift: "no", websiteBookingDetails: details })).toMatchObject({
      pickupFloor: 3,
      pickupLiftAvailable: false,
      deliveryFloor: -1,
      deliveryLiftAvailable: true,
      extraPickupFloors: [],
    });
  });

  it("falls back to the one combined floor/lift for orders without booking details", () => {
    expect(floorPricingInputs({ floorNo: "4", lift: "no", websiteBookingDetails: null })).toEqual({
      pickupFloor: 4,
      pickupLiftAvailable: false,
      deliveryFloor: 4,
      deliveryLiftAvailable: false,
      extraPickupFloors: [],
    });
    expect(floorPricingInputs({ floorNo: null, lift: "yes", websiteBookingDetails: { junk: true } })).toMatchObject({
      pickupFloor: 0,
      deliveryLiftAvailable: true,
    });
  });
});
