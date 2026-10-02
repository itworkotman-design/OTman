import { describe, expect, it } from "vitest";
import { buildOrderReviewBlocks, type ReviewPickup } from "./orderReview";

const pickup: ReviewPickup = {
  source: "store",
  placeName: "Elkjøp Lillestrøm",
  address: "Storgata 1, Lillestrøm",
  floor: 1,
  liftAvailable: false,
  contactName: "Ola",
  contactPhone: "12345678",
};

const base = {
  pickups: [pickup],
  delivery: { address: "Karl Johans gate 1, Oslo", floor: 3, liftAvailable: true },
  preferredDate: "2026-10-05",
  timeWindow: "08-16",
  drivingDistance: "21",
  contact: { name: "Kari", phone: "87654321", email: "kari@example.no", notes: "" },
};

const rows = (block: { rows: { label: string; value: string }[] }) =>
  Object.fromEntries(block.rows.map((row) => [row.label, row.value]));

describe("buildOrderReviewBlocks", () => {
  it("lists one pickup, the delivery and the contact details, in that order", () => {
    const blocks = buildOrderReviewBlocks("no", base);
    expect(blocks.map((block) => block.title)).toEqual(["Henting", "Levering", "Dine opplysninger"]);
  });

  it("marks pickups and the delivery as locations, the contact details as contact", () => {
    const blocks = buildOrderReviewBlocks("no", { ...base, pickups: [pickup, pickup] });
    expect(blocks.map((block) => block.kind)).toEqual(["location", "location", "location", "contact"]);
  });

  it("describes the pickup: type, place, address, floor, contact", () => {
    const [pickupBlock] = buildOrderReviewBlocks("no", base);
    expect(rows(pickupBlock)).toEqual({
      "Hentes fra": "Butikk",
      Sted: "Elkjøp Lillestrøm",
      Adresse: "Storgata 1, Lillestrøm",
      Etasje: "1 · uten heis",
      Kontaktperson: "Ola, 12345678",
    });
  });

  it("numbers pickups and lists their products once the order is split", () => {
    const blocks = buildOrderReviewBlocks("en", {
      ...base,
      pickups: [
        { ...pickup, productNames: ["Washing machine"] },
        { ...pickup, source: "private", placeName: "", productNames: ["Fridge", "Dryer"] },
      ],
    });
    expect(blocks.slice(0, 2).map((block) => block.title)).toEqual(["Pickup 1", "Pickup 2"]);
    expect(rows(blocks[1])).toMatchObject({ "Picked up from": "Private individual", Products: "Fridge, Dryer" });
    expect(rows(blocks[1])).not.toHaveProperty("Place");
  });

  it("describes the delivery with a readable date, the time window and the distance", () => {
    const delivery = buildOrderReviewBlocks("no", base)[1];
    expect(rows(delivery)).toEqual({
      Adresse: "Karl Johans gate 1, Oslo",
      Etasje: "3 · med heis",
      "Ønsket dato": "5. oktober 2026",
      Tidsvindu: "08-16",
      Kjøreavstand: "21 km",
    });
  });

  it("leaves out rows that weren't answered (no floor, no distance, no notes)", () => {
    const blocks = buildOrderReviewBlocks("no", {
      ...base,
      pickups: [{ ...pickup, floor: null }],
      drivingDistance: "",
    });
    expect(rows(blocks[0])).not.toHaveProperty("Etasje");
    expect(rows(blocks[1])).not.toHaveProperty("Kjøreavstand");
    expect(rows(blocks[2])).not.toHaveProperty("Merknader");
  });

  it("includes notes when there are any", () => {
    const contact = buildOrderReviewBlocks("no", { ...base, contact: { ...base.contact, notes: "Ring på" } })[2];
    expect(rows(contact)).toEqual({
      Navn: "Kari",
      Telefon: "87654321",
      "E-post": "kari@example.no",
      Merknader: "Ring på",
    });
  });
});
