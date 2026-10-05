import { describe, expect, it } from "vitest";
import {
  buildDetailsUpdate,
  editableDetailsFromOrder,
  parseAdminOrderDetails,
  routeAddressesChanged,
  type AdminOrderDetails,
} from "./websiteOrderDetailsEdit";

const valid: AdminOrderDetails = {
  customer: {
    name: "Kari Nordmann",
    phone: "87654321",
    email: "kari@example.no",
    comments: "Ring på",
    customerType: "private",
  },
  pickups: [
    {
      source: "store",
      placeName: "Power",
      address: "Strømmen 1",
      floor: null,
      liftAvailable: false,
      contactName: "",
      contactPhone: "",
      productNames: [],
    },
  ],
  delivery: { address: "Kirkegata 5", floor: 3, liftAvailable: false },
  preferredDate: "2026-10-10",
  timeWindow: "08:00-16:00",
  drivingDistanceOverride: null,
};

describe("parseAdminOrderDetails", () => {
  it("accepts well-formed details, trimming text", () => {
    const result = parseAdminOrderDetails({
      ...valid,
      customer: { ...valid.customer, name: "  Kari Nordmann " },
    });
    expect(result).toEqual({ ok: true, details: valid });
  });

  it("lets an admin save anything empty — addresses, stops, name, phone, email", () => {
    const empty = parseAdminOrderDetails({
      ...valid,
      customer: { name: "", phone: "", email: "", comments: "", customerType: null },
      pickups: [{ ...valid.pickups[0], address: "" }],
      delivery: { address: "", floor: null, liftAvailable: false },
      preferredDate: "",
      timeWindow: "",
    });
    expect(empty.ok).toBe(true);
    expect(parseAdminOrderDetails({ ...valid, pickups: [] }).ok).toBe(true);
  });

  it("still checks the format of what is filled in", () => {
    const result = parseAdminOrderDetails({
      ...valid,
      customer: { ...valid.customer, phone: "abc", email: "not-an-email" },
      pickups: [{ ...valid.pickups[0], contactPhone: "xyz" }],
    });
    expect(result).toMatchObject({
      ok: false,
      errors: {
        "customer.phone": expect.any(String),
        "customer.email": expect.any(String),
        "pickup.1.contactPhone": expect.any(String),
      },
    });
  });

  it("keeps which product cards each stop collects", () => {
    const result = parseAdminOrderDetails({
      ...valid,
      pickups: [{ ...valid.pickups[0], cardIds: [0, 2, "x", 1.5] }],
    });
    expect(result).toMatchObject({ ok: true, details: { pickups: [{ cardIds: [0, 2] }] } });
  });

  it("allows an empty email but not a bad distance override", () => {
    expect(parseAdminOrderDetails({ ...valid, customer: { ...valid.customer, email: "" } }).ok).toBe(true);
    expect(parseAdminOrderDetails({ ...valid, drivingDistanceOverride: "12,5" })).toMatchObject({
      ok: true,
      details: { drivingDistanceOverride: "12.5" },
    });
    expect(parseAdminOrderDetails({ ...valid, drivingDistanceOverride: "-3" })).toMatchObject({
      ok: false,
      errors: { drivingDistanceOverride: expect.any(String) },
    });
  });

  it("never gives a store pickup a floor or lift", () => {
    const result = parseAdminOrderDetails({
      ...valid,
      pickups: [{ ...valid.pickups[0], floor: 4, liftAvailable: true }],
    });
    expect(result).toMatchObject({ ok: true, details: { pickups: [{ floor: null, liftAvailable: false }] } });
  });

  it("rejects anything that isn't an object", () => {
    expect(parseAdminOrderDetails(null)).toMatchObject({ ok: false });
  });
});

describe("routeAddressesChanged", () => {
  const stored = { pickupAddress: "Strømmen 1", extraPickupAddress: [], deliveryAddress: "Kirkegata 5" };

  it("is false when every stop's address is the same", () => {
    expect(routeAddressesChanged(stored, valid)).toBe(false);
  });

  it("is true when the delivery, a pickup, or the number of stops changes", () => {
    expect(routeAddressesChanged(stored, { ...valid, delivery: { ...valid.delivery, address: "Storgata 1" } })).toBe(true);
    expect(routeAddressesChanged(stored, { ...valid, pickups: [{ ...valid.pickups[0], address: "Lillestrøm 2" }] })).toBe(true);
    expect(routeAddressesChanged(stored, { ...valid, pickups: [...valid.pickups, { ...valid.pickups[0], address: "B" }] })).toBe(true);
  });
});

describe("buildDetailsUpdate", () => {
  const twoStops: AdminOrderDetails = {
    ...valid,
    pickups: [
      { ...valid.pickups[0], productNames: ["Vaskemaskin"] },
      {
        source: "private",
        placeName: "",
        address: "Bjerke 9",
        floor: -1,
        liftAvailable: false,
        contactName: "Ola",
        contactPhone: "12345678",
        productNames: ["Sofa"],
      },
    ],
  };

  it("writes the order columns the rest of the app reads", () => {
    const { orderData } = buildDetailsUpdate({
      details: twoStops,
      drivingDistance: "33.10",
      storedBookingDetails: null,
      storedDescription: null,
    });
    expect(orderData).toMatchObject({
      customerName: "Kari Nordmann",
      phone: "87654321",
      email: "kari@example.no",
      customerComments: "Ring på",
      pickupAddress: "Strømmen 1",
      extraPickupAddress: ["Bjerke 9"],
      deliveryAddress: "Kirkegata 5",
      deliveryDate: "2026-10-10",
      timeWindow: "08:00-16:00",
      drivingDistance: "33.10",
      // Store pickup = ground floor with lift; the delivery's 3rd floor costs more.
      floorNo: "3",
      lift: "no",
    });
    expect(orderData.description).toBe(
      [
        "Pickup 1 - Store: Power (Strømmen 1) - picking up: Vaskemaskin",
        "",
        "Pickup 2 - Private: Ola / 12345678 (Bjerke 9) - picking up: Sofa",
        "    *floor -1, no lift",
      ].join("\n"),
    );
  });

  it("stores each stop's card ids in the booking details", () => {
    const { bookingDetails } = buildDetailsUpdate({
      details: { ...valid, pickups: [{ ...valid.pickups[0], cardIds: [0, 1] }] },
      drivingDistance: "21",
      storedBookingDetails: null,
      storedDescription: null,
    });
    expect(bookingDetails.pickups[0].cardIds).toEqual([0, 1]);
  });

  it("stores every stop in the booking details, keeping the booked order extras until re-priced", () => {
    const { bookingDetails } = buildDetailsUpdate({
      details: twoStops,
      drivingDistance: "33.10",
      storedBookingDetails: { orderExtras: [{ label: "Etasjetillegg", price: 200, qty: 1 }] },
      storedDescription: null,
    });
    expect(bookingDetails).toMatchObject({
      version: 1,
      customerType: "private",
      delivery: { address: "Kirkegata 5", floor: 3, liftAvailable: false },
      preferredDate: "2026-10-10",
      drivingDistance: "33.10",
      orderExtras: [{ label: "Etasjetillegg", price: 200, qty: 1 }],
    });
    expect(bookingDetails.pickups).toHaveLength(2);
    expect(bookingDetails.pickups[1]).toMatchObject({ address: "Bjerke 9", floor: -1, contactName: "Ola", productNames: ["Sofa"] });
  });

  it("replaces the generated notes in the description but keeps whatever staff added", () => {
    const first = buildDetailsUpdate({ details: valid, drivingDistance: "21", storedBookingDetails: null, storedDescription: null });
    const staffEdited = `${first.orderData.description}\n\nPorten er låst — ring.`;
    const next = buildDetailsUpdate({
      details: { ...valid, pickups: [{ ...valid.pickups[0], placeName: "Elkjøp" }] },
      drivingDistance: "21",
      storedBookingDetails: first.bookingDetails,
      storedDescription: staffEdited,
    });
    expect(next.orderData.description).toContain("Pickup 1 - Store: Elkjøp (Strømmen 1)");
    expect(next.orderData.description).not.toContain("Power");
    expect(next.orderData.description).toContain("Porten er låst — ring.");
  });
});

describe("buildDetailsUpdate — orders with the old note format", () => {
  it("replaces the old pickup notes with the new ones, keeping what staff added", () => {
    const legacyNotes = [
      "Picking up from: Store",
      "Store/business name: Power",
      "",
      "Pickup location 1 (Strømmen 1) — picking up: Vaskemaskin",
      "Pickup location 2 (Bjerke 9, Private individual, floor 3, no lift) — picking up: Sofa",
    ].join("\n");
    const stored = {
      version: 1,
      customerType: "private",
      pickups: [
        { ...valid.pickups[0], productNames: ["Vaskemaskin"] },
        { ...valid.pickups[0], source: "private", placeName: "", address: "Bjerke 9", floor: 3, productNames: ["Sofa"] },
      ],
      delivery: valid.delivery,
      preferredDate: valid.preferredDate,
      timeWindow: valid.timeWindow,
      drivingDistance: "21",
      orderExtras: [],
    };
    const next = buildDetailsUpdate({
      details: { ...valid, pickups: stored.pickups.map((p) => ({ ...p, liftAvailable: false, contactName: "", contactPhone: "" })) as AdminOrderDetails["pickups"] },
      drivingDistance: "21",
      storedBookingDetails: stored,
      storedDescription: `${legacyNotes}\n\nPorten er låst.`,
    });
    expect(next.orderData.description).not.toContain("Pickup location");
    expect(next.orderData.description).toContain("Pickup 2 - Private (Bjerke 9) - picking up: Sofa");
    expect(next.orderData.description).toContain("Porten er låst.");
  });
});

describe("editableDetailsFromOrder", () => {
  it("reads the form values back from the order", () => {
    const { bookingDetails, orderData } = buildDetailsUpdate({
      details: valid,
      drivingDistance: "21",
      storedBookingDetails: null,
      storedDescription: null,
    });
    expect(
      editableDetailsFromOrder({
        ...orderData,
        websiteBookingDetails: bookingDetails,
      }),
    ).toEqual(valid);
  });
});
