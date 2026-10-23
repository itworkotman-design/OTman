import { describe, expect, it } from "vitest";
import { otherManufacturerLabel } from "./otherManufacturer";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";
import { buildOrderSummaryGroups } from "@/lib/orders/orderSummary";
import { localizeWebsiteLineLabel } from "@/lib/content/websiteLineLabels";
import { catalogProductFromSeed } from "@/lib/content/websiteCatalogFixtures";
import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// The company typed for "— Other manufacturer" replaces those words wherever
// the assembly line is shown: the calculator (customer and admin), the stored
// order items, and from those the archive summary and the GSM task.
const bed = catalogProductFromSeed("FN_BED");
const products = [bed];
const otherBed = (modelNumber: string, installId = "ASM_SGL_BED_OTHER") => ({
  ...createEmptyProductCard(0),
  productId: "FN_BED",
  deliveryType: "INDOOR" as const,
  selectedInstallOptionIds: [installId],
  modelNumber,
});

describe("otherManufacturerLabel", () => {
  it("swaps the manufacturer part for the company, in either language", () => {
    expect(otherManufacturerLabel("Single bed — Other manufacturer", "ASM_SGL_BED_OTHER", " Hästens ")).toBe("Single bed — Hästens");
    expect(otherManufacturerLabel("Enkeltseng — Annen produsent", "ASM_SGL_BED_OTHER", "Hästens")).toBe("Enkeltseng — Hästens");
  });

  it("leaves the label alone without a company, or for a named manufacturer", () => {
    expect(otherManufacturerLabel("Single bed — Other manufacturer", "ASM_SGL_BED_OTHER", "  ")).toBe("Single bed — Other manufacturer");
    expect(otherManufacturerLabel("Single bed — IKEA", "ASM_SGL_BED_IKEA", "Hästens")).toBe("Single bed — IKEA");
  });
});

describe("other-manufacturer company on the order lines", () => {
  it("names the company on the calculator's assembly line", () => {
    const pricing = calculateBookingPricing({
      productBreakdowns: buildProductBreakdowns([otherBed("Hästens")], products, []),
      priceLookup: buildPriceLookup(products, []),
    });
    const labels = pricing.breakdowns[0].lines.map((l) => l.label);
    expect(labels).toContain("Single bed — Hästens");
    expect(labels).not.toContain("Single bed — Other manufacturer");
  });

  it("is translated on the Norwegian site, keeping the company", () => {
    expect(localizeWebsiteLineLabel("Single bed — Hästens", "no")).toBe("Enkeltseng — Hästens");
    expect(localizeWebsiteLineLabel("Single bed — Hästens", "en")).toBe("Single bed — Hästens");
  });

  it("stores it on the order item, so admins, the archive and GSM see it", () => {
    const items = buildOrderItemsFromCards([otherBed("Hästens")], products, []);
    const install = items.find((i) => i.itemType === "INSTALL_OPTION")!;
    expect(install.optionLabel).toBe("Single bed — Hästens");
    expect(install.rawData).toMatchObject({ label: "Single bed — Hästens", description: "Enkeltseng — Hästens" });

    const [group] = buildOrderSummaryGroups(items);
    expect(JSON.stringify(group)).toContain("Enkeltseng — Hästens");
    expect(JSON.stringify(group)).not.toContain("Annen produsent");
  });

  it("doesn't touch a named manufacturer's line", () => {
    const items = buildOrderItemsFromCards([otherBed("", "ASM_SGL_BED_IKEA")], products, []);
    expect(items.find((i) => i.itemType === "INSTALL_OPTION")!.optionLabel).toBe("Single bed — IKEA");
  });
});
