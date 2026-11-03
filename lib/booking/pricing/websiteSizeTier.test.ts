import { describe, expect, it } from "vitest";
import { isLargeSizeCard, withWebsiteSizeTiers } from "./websiteSizeTier";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { createDefaultProductAutoDeliveryPrice } from "@/lib/products/autoDeliveryPrice";
import {
  createEmptyProductCard,
  type CatalogOption,
  type CatalogProduct,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// Other furniture ("Andre møbler") is priced as a small or a large item: over
// 1.5 m³ or over 50 kg (whichever is heavier) it's large, delivered at its own
// large-item prices (seeded from the side-by-side fridge) instead of the
// product's (the oven's).

function option(id: string, code: string, category: string, extra: Partial<CatalogOption> = {}): CatalogOption {
  return {
    id,
    code,
    label: code,
    description: null,
    category,
    customerPrice: "0",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "0",
    active: true,
    ...extra,
  };
}

const deliveryType = (key: "FIRST_STEP" | "INDOOR", price: string, subcontractorPrice: string) => ({
  key,
  enabled: true,
  code: key,
  label: key,
  price,
  subcontractorPrice,
  xtraPrice: "160",
  xtraSubcontractorPrice: "105",
  allowInstallOptions: true,
  allowExtraServices: true,
  allowReturnOptions: true,
  allowModelNumber: true,
});

const otherFurniture: CatalogProduct = {
  id: "p-other",
  code: "FN_OTHER_FURNITURE",
  label: "Other furniture",
  active: true,
  productType: "PHYSICAL",
  allowDeliveryTypes: true,
  allowInstallOptions: true,
  allowReturnOptions: true,
  allowExtraServices: true,
  allowDemont: true,
  allowQuantity: true,
  allowPeopleCount: false,
  allowHoursInput: false,
  allowModelNumber: true,
  autoXtraPerPallet: false,
  autoDeliveryPrice: createDefaultProductAutoDeliveryPrice(),
  deliveryTypes: [deliveryType("FIRST_STEP", "616", "405"), deliveryType("INDOOR", "696", "465")],
  customSections: [],
  options: [
    option("vol-s", "OF_VOL_SM", "size_volume", { weightClass: "LIGHT" }),
    option("vol-l", "OF_VOL_LG", "size_volume", { weightClass: "HEAVY" }),
    option("wt-s", "OF_WT_SM", "size_weight", { weightClass: "LIGHT" }),
    option("wt-l", "OF_WT_LG", "size_weight", { weightClass: "HEAVY" }),
    option("large-first", "OF_LG_FIRST_STEP", "size_large_delivery", {
      customerPrice: "1040",
      effectiveCustomerPrice: "1040",
      subcontractorPrice: "620",
    }),
    option("large-indoor", "OF_LG_INDOOR", "size_large_delivery", {
      customerPrice: "1344",
      effectiveCustomerPrice: "1344",
      subcontractorPrice: "825",
    }),
  ],
};

const oven: CatalogProduct = { ...otherFurniture, id: "p-oven", code: "WG_OVEN", options: [] };

function card(volumeId: string, weightId: string, patch: Partial<SavedProductCard> = {}): SavedProductCard {
  return {
    ...createEmptyProductCard(0),
    productId: "p-other",
    deliveryType: DELIVERY_TYPES.INDOOR,
    selectedExtraOptionIds: [volumeId, weightId],
    ...patch,
  };
}

describe("isLargeSizeCard", () => {
  it("is small only when both the volume and the weight are small", () => {
    expect(isLargeSizeCard(card("vol-s", "wt-s"), otherFurniture)).toBe(false);
  });

  it("is large when either is large — the heavier one wins", () => {
    expect(isLargeSizeCard(card("vol-l", "wt-s"), otherFurniture)).toBe(true);
    expect(isLargeSizeCard(card("vol-s", "wt-l"), otherFurniture)).toBe(true);
    expect(isLargeSizeCard(card("vol-l", "wt-l"), otherFurniture)).toBe(true);
  });

  it("is small before anything is picked", () => {
    expect(isLargeSizeCard(card("", ""), otherFurniture)).toBe(false);
  });
});

describe("withWebsiteSizeTiers", () => {
  const delivery = (products: CatalogProduct[], key: string) =>
    products.find((p) => p.id === "p-other")!.deliveryTypes.find((dt) => dt.key === key)!;

  it("leaves a small item at the product's own delivery prices", () => {
    const products = withWebsiteSizeTiers([card("vol-s", "wt-s")], [otherFurniture, oven]);
    expect(products[0]).toBe(otherFurniture);
    expect(products[1]).toBe(oven);
  });

  it("delivers a large item at its large-item prices, keeping the extra-item rate", () => {
    const products = withWebsiteSizeTiers([card("vol-s", "wt-l")], [otherFurniture, oven]);
    expect(delivery(products, "FIRST_STEP")).toMatchObject({ price: "1040", subcontractorPrice: "620", xtraPrice: "160" });
    expect(delivery(products, "INDOOR")).toMatchObject({ price: "1344", subcontractorPrice: "825", xtraPrice: "160" });
    // Its options (ids the card points at) are untouched; other products too.
    expect(products[0].options).toBe(otherFurniture.options);
    expect(products[1]).toBe(oven);
  });

  it("keeps a delivery type's own price when there's no active large price for it", () => {
    const withoutIndoor: CatalogProduct = {
      ...otherFurniture,
      options: otherFurniture.options.map((o) => (o.code === "OF_LG_INDOOR" ? { ...o, active: false } : o)),
    };
    const products = withWebsiteSizeTiers([card("vol-l", "wt-s")], [withoutIndoor]);
    expect(delivery(products, "INDOOR")).toMatchObject({ price: "696", subcontractorPrice: "465" });
    expect(delivery(products, "FIRST_STEP")).toMatchObject({ price: "1040" });
  });
});
