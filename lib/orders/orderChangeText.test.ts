import { describe, expect, it } from "vitest";
import { describeDetailChange, describeLineChange, detailLabel, formatKr } from "./orderChangeText";
import { EXTRAS_GROUP } from "./paidOrderSnapshot";

describe("formatKr", () => {
  it("formats whole and øre amounts the Norwegian way, with an optional sign", () => {
    expect(formatKr(1250)).toBe("1 250 kr");
    expect(formatKr(99.5)).toBe("99,50 kr");
    expect(formatKr(550, { signed: true })).toBe("+550 kr");
    expect(formatKr(-200, { signed: true })).toBe("−200 kr");
  });
});

describe("detailLabel", () => {
  it("names stops, floors and dates in both languages", () => {
    expect(detailLabel("delivery.address", "no")).toBe("Leveringsadresse");
    expect(detailLabel("delivery.address", "en")).toBe("Delivery address");
    expect(detailLabel("pickup.2.floor", "no")).toBe("Henting 2: etasje");
    expect(detailLabel("pickup.1.address", "en")).toBe("Pickup 1: address");
    expect(detailLabel("date", "no")).toBe("Dato");
    expect(detailLabel("unknown.key", "en")).toBe("unknown.key");
  });
});

describe("describeLineChange", () => {
  const base = { group: "Tørketrommel", label: "Levering på dørstokken", qtyBefore: 0, qtyAfter: 1, priceBefore: 0, priceAfter: 550 };

  it("describes an added line with its price", () => {
    expect(describeLineChange({ ...base, kind: "added", delta: 550 }, "no")).toBe(
      "Lagt til: Tørketrommel — Levering på dørstokken (+550 kr)",
    );
  });

  it("describes a removed line", () => {
    expect(
      describeLineChange({ ...base, kind: "removed", qtyBefore: 1, qtyAfter: 0, priceBefore: 550, priceAfter: 0, delta: -550 }, "en"),
    ).toBe("Removed: Tørketrommel — Levering på dørstokken (−550 kr)");
  });

  it("describes a changed line with before → after", () => {
    expect(
      describeLineChange({ ...base, kind: "changed", qtyBefore: 1, qtyAfter: 2, priceBefore: 550, priceAfter: 1100, delta: 550 }, "no"),
    ).toBe("Endret: Tørketrommel — Levering på dørstokken: 1× 550 kr → 2× 1 100 kr (+550 kr)");
  });

  it("names order extras and manual adjustments plainly", () => {
    expect(describeLineChange({ ...base, group: "extras", label: "Etasjetillegg", kind: "added", delta: 200 }, "no")).toBe(
      "Lagt til: Etasjetillegg (+200 kr)",
    );
    expect(describeLineChange({ ...base, group: "adjustment", label: "discount", kind: "added", delta: -100 }, "no")).toBe(
      "Lagt til: Rabatt (−100 kr)",
    );
  });
});

describe("describeDetailChange", () => {
  it("shows before → after, with readable lift/empty values", () => {
    expect(describeDetailChange({ key: "delivery.address", before: "Kirkegata 5", after: "Storgata 1" }, "no")).toBe(
      "Leveringsadresse: Kirkegata 5 → Storgata 1",
    );
    expect(describeDetailChange({ key: "delivery.lift", before: "no", after: "yes" }, "en")).toBe("Delivery: lift: No → Yes");
    expect(describeDetailChange({ key: "pickup.2.address", before: "", after: "Bjerke 9" }, "no")).toBe(
      "Henting 2: adresse: — → Bjerke 9",
    );
    expect(describeDetailChange({ key: "distance", before: "21", after: "33.10" }, "en")).toBe("Driving distance: 21 km → 33.10 km");
  });
});

describe("describeLineChange in Norwegian", () => {
  const base = { qtyBefore: 0, qtyAfter: 1, priceBefore: 0, priceAfter: 155, delta: 155 };

  it("translates the website product name and the seeded delivery label", () => {
    expect(describeLineChange({ ...base, kind: "added", group: "Microwave oven", label: "Delivery to doorstep" }, "no")).toBe(
      "Lagt til: Mikrobølgeovn — Levering til ytterdør (+155 kr)",
    );
  });

  it("translates a seeded order-extra label", () => {
    expect(
      describeLineChange({ ...base, kind: "added", group: EXTRAS_GROUP, label: "Floor surcharge per chargeable floor, no lift" }, "no"),
    ).toContain("Etasjetillegg per etasje uten heis");
  });

  it("leaves English as it is", () => {
    expect(describeLineChange({ ...base, kind: "added", group: "Microwave oven", label: "Delivery to doorstep" }, "en")).toBe(
      "Added: Microwave oven — Delivery to doorstep (+155 kr)",
    );
  });
});
