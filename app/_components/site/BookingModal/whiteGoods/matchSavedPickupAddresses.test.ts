import { describe, expect, it } from "vitest";
import { matchSavedPickupAddresses, type SavedPickupAddress } from "./matchSavedPickupAddresses";

const ADDRESSES: SavedPickupAddress[] = [
  { id: "1", name: "Power Grünerløkka", address: "Thorvald Meyers gate 1, 0472 Oslo", icon: "power", color: "amber" },
  { id: "2", name: "Elkjøp Sandvika", address: "Industriveien 8, 1337 Sandvika", icon: "storefront", color: "blue" },
  { id: "3", name: "OTman warehouse", address: "Gneisveien 8, 2020 Skedsmokorset", icon: "warehouse", color: "blue" },
];

describe("matchSavedPickupAddresses", () => {
  it("matches by name, case-insensitively", () => {
    expect(matchSavedPickupAddresses("power grünerløkka", ADDRESSES)).toEqual([ADDRESSES[0]]);
  });

  it("matches by address, case-insensitively", () => {
    expect(matchSavedPickupAddresses("SANDVIKA", ADDRESSES)).toEqual([ADDRESSES[1]]);
  });

  it("matches a partial substring of either field", () => {
    expect(matchSavedPickupAddresses("gneisveien", ADDRESSES)).toEqual([ADDRESSES[2]]);
  });

  it("returns every match when more than one address qualifies", () => {
    expect(matchSavedPickupAddresses("veien", ADDRESSES)).toEqual([ADDRESSES[1], ADDRESSES[2]]);
  });

  it("returns an empty array below the minimum query length", () => {
    expect(matchSavedPickupAddresses("p", ADDRESSES)).toEqual([]);
    expect(matchSavedPickupAddresses("", ADDRESSES)).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(matchSavedPickupAddresses("nonexistent store", ADDRESSES)).toEqual([]);
  });

  it("trims the query before matching", () => {
    expect(matchSavedPickupAddresses("  power  ", ADDRESSES)).toEqual([ADDRESSES[0]]);
  });
});
