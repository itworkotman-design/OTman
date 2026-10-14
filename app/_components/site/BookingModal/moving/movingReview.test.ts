import { describe, expect, it } from "vitest";
import { emptyMovingProperty, type MovingPropertyDraft } from "@/lib/orders/movingProperty";
import { buildMovingReviewBlocks, type MovingReviewInput } from "./movingReview";

const sizes = [
  { code: "SIZE_UNDER_40", labelEn: "Under 40 m²", labelNo: "Under 40 m²", customerPriceCents: 0, subcontractorPriceCents: 0 },
  { code: "SIZE_UNDER_100", labelEn: "Under 100 m²", labelNo: "Under 100 m²", customerPriceCents: 0, subcontractorPriceCents: 0 },
];

const apartment: MovingPropertyDraft = {
  ...emptyMovingProperty(),
  homeType: "APARTMENT",
  sizeOptionCode: "SIZE_UNDER_40",
  floors: 1,
  floorNumber: 4,
  hasLift: false,
  parking: "WITHIN_50M",
};
const house: MovingPropertyDraft = {
  ...emptyMovingProperty(),
  homeType: "DETACHED",
  sizeOptionCode: "SIZE_UNDER_100",
  floors: 2,
  parking: "OUTSIDE",
};

const input: MovingReviewInput = {
  pickupAddress: "Karl Johans gate 1, 0154 Oslo",
  deliveryAddress: "Bragernes torg 1, 3017 Drammen",
  origin: apartment,
  destination: house,
  sizeOptions: sizes,
  preferredDate: "2026-10-20",
  timeWindow: "10:00-16:00",
  drivingDistance: "42.86",
  contact: { name: "Kari Nordmann", phone: "+47 123 45 678", email: "kari@example.com", notes: "" },
};

const rows = (block: { rows: { label: string; value: string }[] }) => Object.fromEntries(block.rows.map((r) => [r.label, r.value]));

describe("buildMovingReviewBlocks", () => {
  it("has a block per end of the move, then the timing, then the contact details", () => {
    const blocks = buildMovingReviewBlocks("no", input);
    expect(blocks.map((b) => [b.kind, b.title])).toEqual([
      ["location", "Flytter fra"],
      ["location", "Flytter til"],
      ["details", "Tidspunkt"],
      ["contact", "Dine opplysninger"],
    ]);
  });

  it("describes an apartment end: type, size, which floor + lift, parking", () => {
    const [from] = buildMovingReviewBlocks("no", input);
    expect(rows(from)).toEqual({
      Adresse: "Karl Johans gate 1, 0154 Oslo",
      Boligtype: "Leilighet",
      Størrelse: "Under 40 m²",
      "Antall etasjer": "1 etasje",
      Etasje: "4 · uten heis",
      Parkering: "Innen 50 m",
    });
  });

  it("leaves out the floor row for a house, and the lift on the ground floor when unanswered", () => {
    const [, to] = buildMovingReviewBlocks("no", input);
    expect(rows(to).Etasje).toBeUndefined();
    expect(rows(to)["Antall etasjer"]).toBe("2 etasjer");

    const [groundFloor] = buildMovingReviewBlocks("no", { ...input, origin: { ...apartment, floorNumber: 1, hasLift: null } });
    expect(rows(groundFloor).Etasje).toBe("1");
  });

  it("shows the date, time window and driving distance, and leaves out blank contact fields", () => {
    const [, , timing, contact] = buildMovingReviewBlocks("no", input);
    expect(rows(timing)["Tidsvindu"]).toBe("10:00-16:00");
    expect(rows(timing)["Kjøreavstand"]).toBe("42.86 km");
    expect(rows(timing)["Ønsket dato"]).toBeTruthy();
    expect(rows(contact)).toEqual({ Navn: "Kari Nordmann", Telefon: "+47 123 45 678", "E-post": "kari@example.com" });
  });

  it("speaks English on the English site", () => {
    const [from] = buildMovingReviewBlocks("en", input);
    expect(from.title).toBe("Moving from");
    expect(rows(from)).toMatchObject({ "Property type": "Apartment", Floor: "4 · no lift", Parking: "Within 50 m" });
  });
});
