import { describe, expect, it } from "vitest";
import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { AdminPickupStop } from "@/lib/orders/websiteOrderDetailsEdit";
import { adminDetailsFromFlow, pickupStateFromStops } from "./adminOrderState";

const card = (cardId: number, productId = "p") => ({ ...createEmptyProductCard(cardId), productId, amount: 1 });
const cards = [card(0), card(1), card(2, "q")];
const names: Record<number, string> = { 0: "Vaskemaskin #1", 1: "Vaskemaskin #2", 2: "Garderobeskap" };
const nameOf = (cardId: number) => names[cardId] ?? "";

const stop = (overrides: Partial<AdminPickupStop> = {}): AdminPickupStop => ({
  source: "store",
  placeName: "Power",
  address: "Smalvollveien 65",
  floor: null,
  liftAvailable: false,
  contactName: "",
  contactPhone: "",
  productNames: [],
  ...overrides,
});

describe("pickupStateFromStops", () => {
  it("one stop: everything is picked up there", () => {
    expect(pickupStateFromStops({ cards, stops: [stop()], nameOf })).toEqual({
      allProductsPickedUpHere: true,
      pickupCardIds: [],
      extraLocations: [],
    });
  });

  it("puts each product back on its stop by card id, the last stop taking whatever is left", () => {
    const result = pickupStateFromStops({
      cards,
      stops: [
        stop({ cardIds: [0] }),
        stop({ placeName: "elkjop", address: "Trøgstadveien 4", cardIds: [1] }),
        stop({ source: "private", placeName: "", address: "Eivind Olsens vei", floor: 10, contactName: "Ola", cardIds: [2] }),
      ],
      nameOf,
    });
    expect(result.allProductsPickedUpHere).toBe(false);
    expect(result.pickupCardIds).toEqual([0]);
    expect(result.extraLocations).toEqual([
      expect.objectContaining({
        id: 0,
        source: "store",
        placeName: "elkjop",
        address: "Trøgstadveien 4",
        addressSelected: true,
        allRemainingHere: false,
        selectedCardIds: [1],
      }),
      expect.objectContaining({
        id: 1,
        source: "private",
        address: "Eivind Olsens vei",
        floor: 10,
        contactName: "Ola",
        allRemainingHere: true,
      }),
    ]);
  });

  it("puts each extra stop's comment back on its location", () => {
    const result = pickupStateFromStops({
      cards,
      stops: [stop({ cardIds: [0] }), stop({ cardIds: [1, 2], comment: "Varemottak" })],
      nameOf,
    });
    expect(result.extraLocations[0]?.comment).toBe("Varemottak");
  });

  it("falls back to the product names stored on older orders", () => {
    const result = pickupStateFromStops({
      cards,
      stops: [
        stop({ productNames: ["Vaskemaskin #1"] }),
        stop({ productNames: ["Vaskemaskin #2 (×1)"] }),
        stop({ productNames: ["Garderobeskap"] }),
      ],
      nameOf,
    });
    expect(result.pickupCardIds).toEqual([0]);
    expect(result.extraLocations[0]?.selectedCardIds).toEqual([1]);
  });
});

describe("adminDetailsFromFlow", () => {
  it("turns the booking flow's state into the admin save payload", () => {
    const details = adminDetailsFromFlow({
      customerType: "business",
      name: "Ralfs",
      orgNumber: "974760673",
      phone: "93004023",
      email: "r@example.com",
      notes: "pap",
      firstPickup: {
        source: "store",
        placeName: "power",
        address: "Smalvollveien 65",
        floor: null,
        liftAvailable: false,
        contactName: "",
        contactPhone: "",
        cardIds: [0],
        productNames: ["Vaskemaskin #1"],
      },
      extraPickups: [
        {
          source: "private",
          placeName: "",
          address: "Eivind Olsens vei",
          floor: 10,
          liftAvailable: false,
          contactName: "Ola",
          contactPhone: "12345678",
          cardIds: [1, 2],
          productNames: ["Vaskemaskin #2", "Garderobeskap"],
        },
      ],
      delivery: { address: "Otto Blehrs vei 25c", floor: 1, liftAvailable: false },
      preferredDate: "2026-10-15",
      timeWindow: "10:00-16:00",
      drivingDistance: "171.12",
    });
    expect(details).toEqual({
      customer: {
        name: "Ralfs",
        phone: "93004023",
        email: "r@example.com",
        comments: "pap",
        customerType: "business",
        orgNumber: "974760673",
      },
      pickups: [
        expect.objectContaining({ address: "Smalvollveien 65", cardIds: [0], productNames: ["Vaskemaskin #1"] }),
        expect.objectContaining({ address: "Eivind Olsens vei", floor: 10, cardIds: [1, 2] }),
      ],
      delivery: { address: "Otto Blehrs vei 25c", floor: 1, liftAvailable: false },
      preferredDate: "2026-10-15",
      timeWindow: "10:00-16:00",
      // Saved at exactly the distance the editor priced with.
      drivingDistanceOverride: "171.12",
    });
  });

  it("sends each stop's comment, leaving it out when blank", () => {
    const flowStop = {
      source: "private" as const,
      placeName: "",
      address: "Bjerke 9",
      floor: 2,
      liftAvailable: false,
      contactName: "Ola",
      contactPhone: "12345678",
      cardIds: [],
      productNames: [],
    };
    const details = adminDetailsFromFlow({
      customerType: "private",
      name: "Kari",
      orgNumber: "",
      phone: "",
      email: "",
      notes: "",
      firstPickup: { ...flowStop, comment: "Kodelås 1234" },
      extraPickups: [{ ...flowStop, comment: "  " }],
      delivery: { address: "Kirkegata 5", floor: 1, liftAvailable: false },
      preferredDate: "",
      timeWindow: "",
      drivingDistance: "",
    });
    expect(details.pickups[0].comment).toBe("Kodelås 1234");
    expect(details.pickups[1]).not.toHaveProperty("comment");
  });

  it("sends the delivery's comment, leaving it out when blank", () => {
    const flowStop = { source: "store" as const, placeName: "", address: "Strømmen 1", floor: null, liftAvailable: false, contactName: "", contactPhone: "", cardIds: [], productNames: [] };
    const state = (comment: string) => ({
      customerType: "private" as const, name: "Kari", orgNumber: "", phone: "", email: "", notes: "",
      firstPickup: flowStop, extraPickups: [],
      delivery: { address: "Kirkegata 5", floor: 1, liftAvailable: false, comment },
      preferredDate: "", timeWindow: "", drivingDistance: "",
    });
    expect(adminDetailsFromFlow(state(" Ring på ")).delivery).toEqual({ address: "Kirkegata 5", floor: 1, liftAvailable: false, comment: "Ring på" });
    expect(adminDetailsFromFlow(state("  ")).delivery).not.toHaveProperty("comment");
  });

  it("lets the server work the distance out when the editor has none", () => {
    const details = adminDetailsFromFlow({
      customerType: null,
      name: "",
      orgNumber: "",
      phone: "",
      email: "",
      notes: "",
      firstPickup: {
        source: null,
        placeName: "",
        address: "",
        floor: null,
        liftAvailable: false,
        contactName: "",
        contactPhone: "",
        cardIds: [],
        productNames: [],
      },
      extraPickups: [],
      delivery: { address: "", floor: null, liftAvailable: false },
      preferredDate: "",
      timeWindow: "",
      drivingDistance: "",
    });
    expect(details.drivingDistanceOverride).toBeNull();
  });
});
