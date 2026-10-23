import { describe, expect, it } from "vitest";
import {
  TV_SETUP_CHECKLIST,
  cardHasTvSetup,
  findTvSetupCardsIncomplete,
  isTvSetupComplete,
  isTvSetupOptionCode,
  tvSetupLabel,
  tvSetupProviderName,
  type TvSetupDetails,
} from "./tvSetup";
import { MAX_ITEM_NAME_LENGTH } from "@/lib/booking/pricing/sizeBrackets";
import { catalogProductFromSeed } from "@/lib/content/websiteCatalogFixtures";
import { createEmptyProductCard, type SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// TV setup asks the customer to confirm they have everything the technician
// needs (passwords, cables) before it can be booked.
const tv = catalogProductFromSeed("WG_TV");
const products = [tv];
const allItems = TV_SETUP_CHECKLIST.map((item) => item.key);

function details(patch: Partial<TvSetupDetails> = {}): TvSetupDetails {
  return { provider: "ALTIBOX", providerName: "", confirmedItems: allItems, ...patch };
}

function card(cardId: number, patch: Partial<SavedProductCard>): SavedProductCard {
  return { ...createEmptyProductCard(cardId), productId: tv.id, deliveryType: "INDOOR", ...patch };
}

describe("isTvSetupOptionCode", () => {
  it("matches only the TV setup option", () => {
    expect(isTvSetupOptionCode("TV_SETUP")).toBe(true);
    expect(isTvSetupOptionCode("TV_WALL_UNDER_55")).toBe(false);
  });
});

describe("TV setup checklist", () => {
  it("asks for the Wi-Fi password, the TV provider's and TV's logins, and the cables", () => {
    expect(allItems).toEqual(["WIFI", "PROVIDER_LOGIN", "TV_ACCOUNT", "POWER", "HDMI", "ETHERNET", "ANTENNA", "REMOTES"]);
  });
});

describe("isTvSetupComplete", () => {
  it("needs a provider and every checklist item confirmed", () => {
    expect(isTvSetupComplete(details())).toBe(true);
    expect(isTvSetupComplete(details({ provider: "" }))).toBe(false);
    expect(isTvSetupComplete(details({ confirmedItems: allItems.slice(1) }))).toBe(false);
    expect(isTvSetupComplete(null)).toBe(false);
    expect(isTvSetupComplete(undefined)).toBe(false);
  });

  it("needs the provider's name for any other provider", () => {
    expect(isTvSetupComplete(details({ provider: "OTHER", providerName: "  " }))).toBe(false);
    expect(isTvSetupComplete(details({ provider: "OTHER", providerName: "x".repeat(MAX_ITEM_NAME_LENGTH + 1) }))).toBe(false);
    expect(isTvSetupComplete(details({ provider: "OTHER", providerName: "RiksTV" }))).toBe(true);
  });

  it("refuses a provider it doesn't know", () => {
    expect(isTvSetupComplete(details({ provider: "NETFLIX" as TvSetupDetails["provider"] }))).toBe(false);
  });
});

describe("cardHasTvSetup / findTvSetupCardsIncomplete", () => {
  it("flags TV setup cards whose checklist isn't done", () => {
    const cards = [
      card(1, { selectedInstallOptionIds: ["TV_WALL_UNDER_55"], selectedExtraOptionIds: ["TV_SETUP"] }),
      card(2, { selectedInstallOptionIds: ["TV_WALL_UNDER_55"], selectedExtraOptionIds: ["TV_SETUP"], tvSetup: details({ confirmedItems: ["WIFI"] }) }),
      card(3, { selectedInstallOptionIds: ["TV_WALL_UNDER_55"], selectedExtraOptionIds: ["TV_SETUP"], tvSetup: details() }),
      card(4, { selectedInstallOptionIds: ["TV_WALL_UNDER_55"] }),
      card(5, { selectedExtraOptionIds: ["TV_SETUP"] }),
    ];
    expect(cards.map((c) => cardHasTvSetup(c, products))).toEqual([true, true, true, false, true]);
    expect(findTvSetupCardsIncomplete(cards, products)).toEqual([1, 2, 5]);
  });
});

describe("tvSetupProviderName / tvSetupLabel", () => {
  it("names the provider, or the one the customer typed", () => {
    expect(tvSetupProviderName(details({ provider: "GO3" }))).toBe("Go3");
    expect(tvSetupProviderName(details({ provider: "OTHER", providerName: " RiksTV " }))).toBe("RiksTV");
    expect(tvSetupProviderName(null)).toBe("");
  });

  it("adds the provider to the setup line, leaving every other line alone", () => {
    expect(tvSetupLabel("TV setup", "TV_SETUP", details({ provider: "TET" }))).toBe("TV setup — Tet");
    expect(tvSetupLabel("TV setup", "TV_SETUP", null)).toBe("TV setup");
    expect(tvSetupLabel("Wall mount", "TV_WALL_UNDER_55", details())).toBe("Wall mount");
  });
});
