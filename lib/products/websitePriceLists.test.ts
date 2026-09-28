import { describe, expect, it } from "vitest";
import { isWebsitePriceList, splitWebsitePriceLists } from "./websitePriceLists";

describe("isWebsitePriceList", () => {
  it("matches a name containing 'website', in any case", () => {
    expect(isWebsitePriceList("Website — Parcel/Pallet")).toBe(true);
    expect(isWebsitePriceList("website")).toBe(true);
    expect(isWebsitePriceList("Power WEBSITE list")).toBe(true);
  });

  it("doesn't match other price lists", () => {
    expect(isWebsitePriceList("Default")).toBe(false);
    expect(isWebsitePriceList("")).toBe(false);
    expect(isWebsitePriceList(null)).toBe(false);
    expect(isWebsitePriceList(undefined)).toBe(false);
  });
});

describe("splitWebsitePriceLists", () => {
  const lists = [
    { id: "1", name: "Default" },
    { id: "2", name: "Website — White goods" },
    { id: "3", name: "Power" },
    { id: "4", name: "Website — Furniture" },
  ];

  it("separates website lists from the rest, keeping each group's order", () => {
    const { regular, website } = splitWebsitePriceLists(lists);

    expect(regular.map((l) => l.id)).toEqual(["1", "3"]);
    expect(website.map((l) => l.id)).toEqual(["2", "4"]);
  });

  it("returns two empty groups for no lists", () => {
    expect(splitWebsitePriceLists([])).toEqual({ regular: [], website: [] });
  });
});
