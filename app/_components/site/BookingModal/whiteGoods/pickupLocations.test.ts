import { describe, expect, it } from "vitest";
import {
  claimedCardIds,
  createPickupLocation,
  groupByCategory,
  hasEnteredOrderOrContactDetails,
  isPickupLocationReady,
  nextPickupLocationId,
  orderedCardIds,
  poolsForLocations,
  remainingAfterClaim,
  routeStopsForDistance,
  syncPickupLocations,
  type PickupLocationState,
} from "./pickupLocations";

function location(overrides: Partial<PickupLocationState> = {}): PickupLocationState {
  return { ...createPickupLocation(0), ...overrides };
}

describe("orderedCardIds", () => {
  it("lists every card that has a product, in order — one entry per card, not deduped", () => {
    const cards = [{ cardId: 0, productId: "a" }, { cardId: 1, productId: "b" }, { cardId: 2, productId: "a" }];
    expect(orderedCardIds(cards)).toEqual([0, 1, 2]);
  });

  it("skips cards with no product", () => {
    expect(orderedCardIds([{ cardId: 0, productId: null }, { cardId: 1, productId: "a" }])).toEqual([1]);
  });
});

describe("claimedCardIds", () => {
  it("claims everything when the pool has one item or fewer, regardless of selection", () => {
    expect(claimedCardIds([1], false, [])).toEqual([1]);
    expect(claimedCardIds([], false, [])).toEqual([]);
  });

  it("claims everything when 'all here' is checked", () => {
    expect(claimedCardIds([1, 2, 3], true, [])).toEqual([1, 2, 3]);
  });

  it("otherwise claims only the explicitly selected ids that are actually in the pool", () => {
    expect(claimedCardIds([1, 2, 3], false, [2, 99])).toEqual([2]);
  });
});

describe("remainingAfterClaim", () => {
  it("is the pool minus whatever was claimed", () => {
    expect(remainingAfterClaim([1, 2, 3], [2])).toEqual([1, 3]);
  });
});

describe("isPickupLocationReady", () => {
  it("is false without a pickup source", () => {
    expect(isPickupLocationReady(location({ source: null }), [1])).toBe(false);
  });

  it("requires an explicit selection once the pool has more than one item and 'all here' is unchecked", () => {
    const loc = location({
      source: "store",
      placeName: "Elkjøp",
      address: "Storgata 1",
      addressSelected: true,
      allRemainingHere: false,
      selectedCardIds: [],
    });
    expect(isPickupLocationReady(loc, [1, 2])).toBe(false);
    expect(isPickupLocationReady({ ...loc, selectedCardIds: [1] }, [1, 2])).toBe(true);
  });

  it("needs no selection when the pool has one item or fewer", () => {
    const loc = location({
      source: "store",
      placeName: "Elkjøp",
      address: "Storgata 1",
      addressSelected: true,
      allRemainingHere: false,
      selectedCardIds: [],
    });
    expect(isPickupLocationReady(loc, [1])).toBe(true);
  });

  it("starts with no floor chosen", () => {
    expect(createPickupLocation(0).floor).toBeNull();
  });

  it("requires a floor for a private or business pickup, but not a store", () => {
    const loc = location({
      source: "private",
      address: "Storgata 1",
      addressSelected: true,
      contactName: "Kari",
      contactPhone: "41234567",
    });
    expect(isPickupLocationReady(loc, [1])).toBe(false);
    expect(isPickupLocationReady({ ...loc, floor: 1 }, [1])).toBe(true);
    expect(
      isPickupLocationReady(location({ source: "store", placeName: "Elkjøp", address: "Storgata 1", addressSelected: true }), [1]),
    ).toBe(true);
  });

  it("needs no selection when 'all here' is checked", () => {
    const loc = location({
      source: "store",
      placeName: "Elkjøp",
      address: "Storgata 1",
      addressSelected: true,
      allRemainingHere: true,
    });
    expect(isPickupLocationReady(loc, [1, 2, 3])).toBe(true);
  });
});

describe("syncPickupLocations", () => {
  it("stays empty once there is nothing left to assign", () => {
    expect(syncPickupLocations([], [], () => 0)).toEqual([]);
  });

  it("appends one fresh location the moment something is left unassigned", () => {
    const next = syncPickupLocations([], [1, 2], () => 5);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe(5);
  });

  it("stops looking further ahead once it reaches a location that hasn't claimed anything yet", () => {
    const undecided = location({ id: 1, allRemainingHere: false, selectedCardIds: [] });
    const next = syncPickupLocations([undecided], [1, 2, 3], () => 9);
    expect(next).toEqual([undecided]);
  });

  it("appends a further location once the chain is fully decided but something is still left over", () => {
    const decided = location({ id: 1, allRemainingHere: false, selectedCardIds: [1] });
    const next = syncPickupLocations([decided], [1, 2], () => 9);
    expect(next.map((l) => l.id)).toEqual([1, 9]);
  });

  it("drops stale trailing locations once an earlier one claims everything", () => {
    const claimsAll = location({ id: 1, allRemainingHere: true });
    const stale = location({ id: 2 });
    const next = syncPickupLocations([claimsAll, stale], [1], () => 9);
    expect(next).toEqual([claimsAll]);
  });

  it("drops every location once the first location's own remaining pool is already empty", () => {
    const stale = location({ id: 1 });
    expect(syncPickupLocations([stale], [], () => 9)).toEqual([]);
  });
});

describe("poolsForLocations", () => {
  it("offers each location the pool left over from the ones before it", () => {
    const loc1 = location({ id: 1, allRemainingHere: false, selectedCardIds: [1] });
    const loc2 = location({ id: 2, allRemainingHere: true });
    const { pools, finalRemaining } = poolsForLocations([loc1, loc2], [1, 2, 3]);

    expect(pools).toEqual([
      [1, 2, 3],
      [2, 3],
    ]);
    expect(finalRemaining).toEqual([]);
  });

  it("leaves finalRemaining non-empty while nothing has claimed the rest yet", () => {
    const loc1 = location({ id: 1, allRemainingHere: false, selectedCardIds: [] });
    const { finalRemaining } = poolsForLocations([loc1], [1, 2]);
    expect(finalRemaining).toEqual([1, 2]);
  });
});

describe("nextPickupLocationId", () => {
  it("is one above the highest existing id", () => {
    expect(nextPickupLocationId([location({ id: 0 }), location({ id: 3 })])).toBe(4);
  });

  it("starts at 0 with no locations", () => {
    expect(nextPickupLocationId([])).toBe(0);
  });
});

describe("groupByCategory", () => {
  it("groups items under their category, in first-seen category order", () => {
    const items = [1, 2, 3, 4];
    const categoryOf = (n: number) => (n <= 2 ? "white-goods" : "furniture");

    expect(groupByCategory(items, categoryOf)).toEqual([
      { category: "white-goods", items: [1, 2] },
      { category: "furniture", items: [3, 4] },
    ]);
  });

  it("keeps a later item under a category it already saw, even out of order", () => {
    const items = [1, 2, 3];
    const categoryOf = (n: number) => (n === 2 ? "b" : "a");

    expect(groupByCategory(items, categoryOf)).toEqual([
      { category: "a", items: [1, 3] },
      { category: "b", items: [2] },
    ]);
  });

  it("returns nothing for an empty list", () => {
    expect(groupByCategory<number>([], () => "x")).toEqual([]);
  });
});

describe("hasEnteredOrderOrContactDetails", () => {
  const blank = { deliveryAddress: "", preferredDate: "", timeWindow: "", name: "", phone: "", email: "", notes: "" };

  it("is false when every field is blank or whitespace-only", () => {
    expect(hasEnteredOrderOrContactDetails(blank)).toBe(false);
    expect(hasEnteredOrderOrContactDetails({ ...blank, notes: "   " })).toBe(false);
  });

  it("is true once any field has real content", () => {
    expect(hasEnteredOrderOrContactDetails({ ...blank, deliveryAddress: "Storgata 2" })).toBe(true);
    expect(hasEnteredOrderOrContactDetails({ ...blank, name: "Kari" })).toBe(true);
  });
});

describe("routeStopsForDistance", () => {
  const base = {
    pickupAddress: "Karl Johans gate 1, Oslo",
    pickupAddressSelected: true,
    deliveryAddress: "Storgata 10, Lillestrøm",
    deliveryAddressSelected: true,
  };

  it("routes pickup 1 straight to delivery when there are no extra pickups", () => {
    expect(routeStopsForDistance({ ...base, extraLocations: [] })).toEqual({
      pickupAddress: "Karl Johans gate 1, Oslo",
      extraPickupAddresses: [],
      deliveryAddress: "Storgata 10, Lillestrøm",
    });
  });

  it("puts every extra pickup between pickup 1 and delivery, in order", () => {
    expect(
      routeStopsForDistance({
        ...base,
        extraLocations: [
          location({ address: " Drammensveien 5, Oslo ", addressSelected: true }),
          location({ address: "Kirkegata 2, Lillestrøm", addressSelected: true }),
        ],
      }),
    ).toEqual({
      pickupAddress: "Karl Johans gate 1, Oslo",
      extraPickupAddresses: ["Drammensveien 5, Oslo", "Kirkegata 2, Lillestrøm"],
      deliveryAddress: "Storgata 10, Lillestrøm",
    });
  });

  it("waits while an extra pickup's address is missing or not picked from the suggestions", () => {
    expect(routeStopsForDistance({ ...base, extraLocations: [location()] })).toBeNull();
    expect(
      routeStopsForDistance({ ...base, extraLocations: [location({ address: "Drammensv", addressSelected: false })] }),
    ).toBeNull();
  });

  it("waits while pickup 1 or delivery isn't a picked address", () => {
    expect(routeStopsForDistance({ ...base, pickupAddressSelected: false, extraLocations: [] })).toBeNull();
    expect(routeStopsForDistance({ ...base, deliveryAddress: "  ", extraLocations: [] })).toBeNull();
  });
});
