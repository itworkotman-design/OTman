import { describe, expect, it } from "vitest";
import { applyWebsiteInstallOnlyVisit, previewInstallOnlyVisitPrice } from "./websiteInstallOnlyVisit";
import { buildProductBreakdowns } from "./fromProductCards";
import { buildPriceLookup } from "./priceLookup";
import { calculateBookingPricing } from "./engine";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";
import { catalogProductFromSeed } from "@/lib/content/websiteCatalogFixtures";
import {
  createEmptyProductCard,
  type CatalogProduct,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// "Kun montering" is still a trip out to the customer, with its own price
// (seeded as a flat 609 kr). It competes with the delivered items for
// the order's one full-price slot (highest price wins, ties go to the earlier
// card): as the full-price card it pays its price, as an extra card it's free.

const bed = catalogProductFromSeed("FN_BED");
const products = [bed];
// Install-only is seeded at a flat 609 kr (subcontractor 400).
const INSTALL_ONLY_PRICE = 609;
const INSTALL_ONLY_SUB_PRICE = 400;
// FN_BED: doorstep 608.88 → 610 kr (155 as an extra card), carry-in 690 kr.
const DOORSTEP_PRICE = 610;
const DOORSTEP_XTRA_PRICE = 155;
const INDOOR_PRICE = 690;
// A bed whose doorstep price is below install-only's, so install-only wins.
const cheapDoorstepBed: CatalogProduct = {
  ...bed,
  deliveryTypes: bed.deliveryTypes.map((dt) => (dt.key === "FIRST_STEP" ? { ...dt, price: "500" } : dt)),
};

function card(cardId: number, deliveryType: SavedProductCard["deliveryType"]): SavedProductCard {
  return { ...createEmptyProductCard(cardId), productId: "FN_BED", deliveryType };
}

function priced(
  cards: SavedProductCard[],
  options?: { zeroBaseDeliveryPricesOver100Km?: boolean },
  catalog: CatalogProduct[] = products,
) {
  const breakdowns = applyWebsiteInstallOnlyVisit(
    buildProductBreakdowns(cards, catalog, [], { ...options, installOnlyVisitPricing: true }),
    cards,
    catalog,
  );
  return calculateBookingPricing({ productBreakdowns: breakdowns, priceLookup: buildPriceLookup(catalog, []) });
}

describe("install-only pricing (installOnlyVisitPricing)", () => {
  it("charges the install-only price for a lone install-only item", () => {
    const result = priced([card(1, "INSTALL_ONLY")]);
    expect(result.totals.subtotalExVat).toBe(INSTALL_ONLY_PRICE);
    expect(result.totals.subcontractorTotal).toBe(INSTALL_ONLY_SUB_PRICE);
  });

  it("charges only the first of several install-only items", () => {
    expect(priced([card(1, "INSTALL_ONLY"), card(2, "INSTALL_ONLY")]).totals.subtotalExVat).toBe(
      INSTALL_ONLY_PRICE,
    );
  });

  it("keeps install-only free when a delivered card is the full-price card", () => {
    expect(priced([card(1, "INDOOR"), card(2, "INSTALL_ONLY")]).totals.subtotalExVat).toBe(INDOOR_PRICE);
    // Doorstep (610) also outprices install-only (609).
    expect(priced([card(1, "INSTALL_ONLY"), card(2, "FIRST_STEP")]).totals.subtotalExVat).toBe(DOORSTEP_PRICE);
  });

  it("takes the full-price slot from a cheaper delivery, which drops to its extra rate", () => {
    expect(
      priced([card(1, "FIRST_STEP"), card(2, "INSTALL_ONLY")], undefined, [cheapDoorstepBed]).totals.subtotalExVat,
    ).toBe(INSTALL_ONLY_PRICE + DOORSTEP_XTRA_PRICE);
  });

  it("uses the product's own install-only price, not carry-in", () => {
    const edited: CatalogProduct = {
      ...bed,
      deliveryTypes: bed.deliveryTypes.map((dt) => (dt.key === "INSTALL_ONLY" ? { ...dt, price: "450" } : dt)),
    };
    expect(priced([card(1, "INSTALL_ONLY")], undefined, [edited]).totals.subtotalExVat).toBe(450);
  });

  it("follows the over-100 km rule that zeroes base delivery prices", () => {
    expect(priced([card(1, "INSTALL_ONLY")], { zeroBaseDeliveryPricesOver100Km: true }).totals.subtotalExVat).toBe(0);
  });

  it("stores the install-only price as an order line, and nothing for the free one", () => {
    const items = buildOrderItemsFromCards([card(1, "INSTALL_ONLY"), card(2, "INSTALL_ONLY")], products, [], {
      installOnlyVisitPricing: true,
    });
    const priceLines = items.filter((i) => i.itemType === "EXTRA_OPTION");
    expect(priceLines).toHaveLength(1);
    expect(priceLines[0]).toMatchObject({
      cardId: 1,
      optionCode: "INSTALL_ONLY",
      customerPriceCents: INSTALL_ONLY_PRICE * 100,
      subcontractorPriceCents: INSTALL_ONLY_SUB_PRICE * 100,
    });
  });

  it("stores the outpriced delivery at its extra rate", () => {
    const items = buildOrderItemsFromCards([card(1, "FIRST_STEP"), card(2, "INSTALL_ONLY")], [cheapDoorstepBed], [], {
      installOnlyVisitPricing: true,
    });
    const doorstep = items.find((i) => i.cardId === 1 && i.itemType === "EXTRA_OPTION");
    expect(doorstep?.customerPriceCents).toBe(DOORSTEP_XTRA_PRICE * 100);
  });
});

describe("applyWebsiteInstallOnlyVisit", () => {
  it("labels free install-only lines with the install-only code, never as an extra delivery", () => {
    const result = priced([card(1, "INSTALL_ONLY"), card(2, "INSTALL_ONLY")]);
    const second = result.breakdowns.find((b) => b.cardId === 2);
    expect(second?.lines.map((l) => l.code)).toEqual(["INSTALL_ONLY"]);
    expect(second?.lines[0].lineTotal).toBe(0);
  });
});

describe("previewInstallOnlyVisitPrice", () => {
  it("shows the install-only price on the full-price card", () => {
    expect(previewInstallOnlyVisitPrice([card(1, "INDOOR")], products, 1)).toBe(INSTALL_ONLY_PRICE);
    expect(previewInstallOnlyVisitPrice([card(1, "FIRST_STEP"), card(2, "INDOOR")], products, 2)).toBe(
      INSTALL_ONLY_PRICE,
    );
  });

  it("is null (shown as nothing) on extra cards", () => {
    expect(previewInstallOnlyVisitPrice([card(1, "INSTALL_ONLY"), card(2, "")], products, 2)).toBeNull();
    expect(previewInstallOnlyVisitPrice([card(1, "FIRST_STEP"), card(2, "INDOOR")], products, 1)).toBeNull();
    expect(previewInstallOnlyVisitPrice([card(1, ""), card(2, "FIRST_STEP")], products, 1)).toBeNull();
  });
});
