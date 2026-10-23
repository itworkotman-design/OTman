import { describe, expect, it } from "vitest";
import { TV_SETUP_CHECKLIST } from "./tvSetup";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import {
  applyWebsiteAssemblyExtras,
  buildWebsiteAssemblyExtraOrderItems,
} from "@/lib/booking/pricing/websiteAssemblyExtras";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";
import { localizeWebsiteLineLabel } from "@/lib/content/websiteLineLabels";
import { catalogProductFromSeed } from "@/lib/content/websiteCatalogFixtures";
import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// TV setup is an additional service, booked with or without mounting. It is
// charged either way, and the TV provider the customer picked is named on its
// line wherever it's shown: the calculator, the stored order items, and from
// those the archive summary and the GSM task — so the technician knows what
// to log into.
const tv = catalogProductFromSeed("WG_TV");
const products = [tv];
const setupCard = (installIds: string[]) => ({
  ...createEmptyProductCard(0),
  productId: "WG_TV",
  deliveryType: "INDOOR" as const,
  selectedInstallOptionIds: installIds,
  selectedExtraOptionIds: ["TV_SETUP"],
  tvSetup: { provider: "ALTIBOX" as const, providerName: "", confirmedItems: TV_SETUP_CHECKLIST.map((i) => i.key) },
});

function setupLine(installIds: string[]) {
  const cards = [setupCard(installIds)];
  const breakdowns = applyWebsiteAssemblyExtras(buildProductBreakdowns(cards, products, []), cards, products);
  const pricing = calculateBookingPricing({ productBreakdowns: breakdowns, priceLookup: buildPriceLookup(products, []) });
  return pricing.breakdowns[0].lines.find((l) => l.label.startsWith("TV setup"));
}

function storedSetupItem(installIds: string[]) {
  const cards = [setupCard(installIds)];
  const items = [...buildOrderItemsFromCards(cards, products, []), ...buildWebsiteAssemblyExtraOrderItems(cards, products)];
  return items.filter((i) => i.itemType === "EXTRA_OPTION" && i.optionCode === "TV_SETUP");
}

describe("TV setup on the order lines", () => {
  it.each([
    ["without mounting", []],
    ["with a wall mount", ["TV_WALL_UNDER_55"]],
  ])("is charged 800 ex. VAT once %s, naming the provider", (_, installIds) => {
    const line = setupLine(installIds);
    expect(line?.label).toBe("TV setup — Altibox");
    expect(line?.lineTotal).toBe(800);
  });

  it.each([
    ["without mounting", []],
    ["with a wall mount", ["TV_WALL_UNDER_55"]],
  ])("is stored once on the order %s, in both languages", (_, installIds) => {
    const items = storedSetupItem(installIds);
    expect(items).toHaveLength(1);
    expect(items[0].optionLabel).toBe("TV setup — Altibox");
    expect(items[0].customerPriceCents).toBe(80000);
    expect(items[0].rawData).toMatchObject({ label: "TV setup — Altibox", description: "TV-oppsett — Altibox" });
  });

  it("is translated on the Norwegian site, keeping the provider", () => {
    expect(localizeWebsiteLineLabel("TV setup — Altibox", "no")).toBe("TV-oppsett — Altibox");
    expect(localizeWebsiteLineLabel("TV setup", "no")).toBe("TV-oppsett");
  });
});
