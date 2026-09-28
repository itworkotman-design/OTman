import { describe, expect, it } from "vitest";
import { FURNITURE_PRODUCTS, FURNITURE_PRICE_LIST_CODE } from "./furnitureCatalog";
import { WHITE_GOODS_ORDER_LEVEL_EXTRAS } from "./whiteGoodsElectronics";
import { VOLUME_BRACKET_MAX_M3 } from "@/lib/booking/pricing/sizeDimensions";

// Source: "Otman_furniture_product_options_2026_FINAL(2).xlsx". The catalog
// data file is generated from it (scripts/generate-furniture-catalog-data.ts);
// these tests pin the shape and a handful of numbers against the source so a
// bad regeneration or hand edit is caught.

const byCode = (code: string) => {
  const product = FURNITURE_PRODUCTS.find((p) => p.code === code);
  if (!product) throw new Error(`missing ${code}`);
  return product;
};
const opt = (productCode: string, optionCode: string) => {
  const option = byCode(productCode).options.find((o) => o.code === optionCode);
  if (!option) throw new Error(`missing ${productCode}/${optionCode}`);
  return option;
};

describe("furniture catalog shape", () => {
  it("uses the WEBSITE_FURNITURE price list code", () => {
    expect(FURNITURE_PRICE_LIST_CODE).toBe("WEBSITE_FURNITURE");
  });

  it("has the 23 products from the source, FN_-prefixed and unique", () => {
    expect(FURNITURE_PRODUCTS).toHaveLength(23);
    const codes = FURNITURE_PRODUCTS.map((p) => p.code);
    expect(new Set(codes).size).toBe(23);
    expect(codes.every((c) => c.startsWith("FN_"))).toBe(true);
    const sortOrders = FURNITURE_PRODUCTS.map((p) => p.sortOrder);
    expect(new Set(sortOrders).size).toBe(23);
    expect(codes).toContain("FN_CHILDRENS_FURNITURE");
  });

  it("has unique option codes within each product and a label in both languages", () => {
    for (const product of FURNITURE_PRODUCTS) {
      const codes = product.options.map((o) => o.code);
      expect(new Set(codes).size, product.code).toBe(codes.length);
      expect(product.nameEn.length, product.code).toBeGreaterThan(0);
      expect(product.nameNo.length, product.code).toBeGreaterThan(0);
      for (const option of product.options) {
        expect(option.labelEn.length, `${product.code}/${option.code}`).toBeGreaterThan(0);
        expect(option.labelNo.length, `${product.code}/${option.code}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("delivery prices", () => {
  it("prices normal furniture at 608.88 / 690.408, with the 154.8 / 236.328 extra-item rates", () => {
    const { firstStep, indoor } = byCode("FN_BED").deliveryTypes;
    expect(firstStep.customerPrice).toBeCloseTo(608.88);
    expect(firstStep.subcontractorPrice).toBeCloseTo(402.48);
    expect(firstStep.xtraPrice).toBeCloseTo(154.8);
    expect(indoor.customerPrice).toBeCloseTo(690.408);
    expect(indoor.subcontractorPrice).toBeCloseTo(464.4);
    expect(indoor.xtraPrice).toBeCloseTo(236.328);
  });

  it("uses Side-by-Side pricing (1030.968 / 1341.6) for exactly Dining set, Sofa and Sofa bed", () => {
    const heavy = FURNITURE_PRODUCTS.filter((p) => p.deliveryTypes.firstStep.customerPrice > 1000).map((p) => p.code);
    expect(heavy.sort()).toEqual(["FN_DINING_SET", "FN_SOFA", "FN_SOFA_BED"]);
    const { firstStep, indoor } = byCode("FN_SOFA").deliveryTypes;
    expect(firstStep.customerPrice).toBeCloseTo(1030.968);
    expect(firstStep.subcontractorPrice).toBeCloseTo(619.2);
    expect(indoor.customerPrice).toBeCloseTo(1341.6);
    expect(indoor.subcontractorPrice).toBeCloseTo(825.6);
  });

  it("does not discount a second heavy item: its extra-item rate equals the full heavy price", () => {
    const { firstStep, indoor } = byCode("FN_SOFA").deliveryTypes;
    expect(firstStep.xtraPrice).toBeCloseTo(firstStep.customerPrice);
    expect(indoor.xtraPrice).toBeCloseTo(indoor.customerPrice);
  });
});

describe("assembly (type + manufacturer) options", () => {
  it("has one exclusive 'type' option per type/manufacturer combination — 255 across the catalog", () => {
    const assembly = FURNITURE_PRODUCTS.flatMap((p) => p.options.filter((o) => o.exclusiveGroup === "type"));
    expect(assembly).toHaveLength(255);
    for (const option of assembly) {
      expect(option.category).toBe("install");
      expect(option.typeEn && option.typeNo && option.manufacturer && option.manufacturerNo).toBeTruthy();
    }
  });

  it("prices IKEA single bed assembly at 850 / 600 and 'Other manufacturer' at 1000 / 700 (Sofa)", () => {
    const bed = opt("FN_BED", "ASM_SINGLE_BED_IKEA");
    expect(bed.customerPrice).toBe(850);
    expect(bed.subcontractorPrice).toBe(600);
    expect(bed.typeEn).toBe("Single bed");
    expect(bed.manufacturer).toBe("IKEA");
    expect(opt("FN_SOFA", "ASM_STANDARD_2_3_SEAT_FIXED_COVER_OTHER_MANUFACTURER").customerPrice).toBe(1000);
  });

  it("keeps delivery + assembly = carry-in + assembly for every combination (the source's own identity)", () => {
    for (const product of FURNITURE_PRODUCTS) {
      for (const option of product.options.filter((o) => o.exclusiveGroup === "type")) {
        expect(option.combinedWithIndoorInstall, `${product.code}/${option.code}`).toBeDefined();
        expect(
          product.deliveryTypes.indoor.customerPrice + option.customerPrice,
          `${product.code}/${option.code} customer`,
        ).toBeCloseTo(option.combinedWithIndoorInstall!.customerPrice, 2);
        expect(
          product.deliveryTypes.indoor.subcontractorPrice + option.subcontractorPrice,
          `${product.code}/${option.code} subcontractor`,
        ).toBeCloseTo(option.combinedWithIndoorInstall!.subcontractorPrice, 2);
      }
    }
  });

  it("offers assembly-only for every product that has assembly options, and for none that don't", () => {
    for (const product of FURNITURE_PRODUCTS) {
      const hasAssembly = product.options.some((o) => o.exclusiveGroup === "type");
      expect(product.deliveryTypes.installOnlyEnabled, product.code).toBe(hasAssembly);
    }
    expect(byCode("FN_MATTRESS").deliveryTypes.installOnlyEnabled).toBe(false);
  });
});

describe("add-ons", () => {
  it("has unpacking at 103.2 / 51.6 and recycling return at 258 / 154.8", () => {
    expect(opt("FN_BED", "UNPACKING").customerPrice).toBeCloseTo(103.2);
    expect(opt("FN_BED", "UNPACKING").subcontractorPrice).toBeCloseTo(51.6);
    expect(opt("FN_BED", "RETURN_RECYCLING").customerPrice).toBe(258);
    expect(opt("FN_BED", "RETURN_RECYCLING").category).toBe("return");
  });

  it("has two paid dismantling variants per relevant type — for disposal and careful for reuse", () => {
    expect(opt("FN_BED", "DISMANTLE_DISPOSAL_SINGLE_BED").customerPrice).toBe(400);
    expect(opt("FN_BED", "DISMANTLE_DISPOSAL_SINGLE_BED").subcontractorPrice).toBe(250);
    expect(opt("FN_BED", "DISMANTLE_CAREFUL_SINGLE_BED").customerPrice).toBe(650);
    expect(opt("FN_BED", "DISMANTLE_CAREFUL_SINGLE_BED").subcontractorPrice).toBe(450);
    expect(opt("FN_BED", "DISMANTLE_DISPOSAL_BUNK_FAMILY_BED").customerPrice).toBe(1150);
  });

  it("offers no dismantling for chairs and other small items", () => {
    for (const code of ["FN_CHAIR", "FN_OFFICE_CHAIR", "FN_MATTRESS", "FN_BEDSIDE_TABLE", "FN_ARMCHAIR_RECLINER"]) {
      expect(byCode(code).options.some((o) => o.code.startsWith("DISMANTLE_")), code).toBe(false);
    }
  });

  it("has wall anchoring at 463.368 / 308.568 where the source offers it", () => {
    expect(opt("FN_BOOKCASE", "WALL_ANCHORING").customerPrice).toBeCloseTo(463.368);
    expect(byCode("FN_SOFA").options.some((o) => o.code === "WALL_ANCHORING")).toBe(false);
  });
});

describe("Other furniture", () => {
  it("is a real product with delivery, unpacking and return, but no assembly — flagged as needing implementation", () => {
    const other = byCode("FN_OTHER_FURNITURE");
    // (plus the size brackets — see "Other furniture size brackets" below)
    expect(other.options.filter((o) => !o.category.startsWith("size_")).map((o) => o.code).sort()).toEqual(["RETURN_RECYCLING", "UNPACKING"]);
    expect(other.deliveryTypes.installOnlyEnabled).toBe(false);
    expect(other.needsImplementation).toEqual({
      labelEn: "Assembly — needs implementation",
      labelNo: "Montering — trenger implementering",
    });
  });

  it("no other product is flagged", () => {
    expect(FURNITURE_PRODUCTS.filter((p) => p.needsImplementation).map((p) => p.code)).toEqual(["FN_OTHER_FURNITURE"]);
  });
});

describe("Other furniture size brackets", () => {
  const sizeOptions = (productCode: string, category: string) =>
    byCode(productCode).options.filter((o) => o.category === category);

  it("offers 5 volume (m³) and 5 weight (kg) brackets, each a radio group", () => {
    const volume = sizeOptions("FN_OTHER_FURNITURE", "size_volume");
    const weight = sizeOptions("FN_OTHER_FURNITURE", "size_weight");

    expect(volume.map((o) => o.code)).toEqual(["OF_VOL_1", "OF_VOL_2", "OF_VOL_3", "OF_VOL_4", "OF_VOL_5"]);
    expect(weight.map((o) => o.code)).toEqual(["OF_WT_1", "OF_WT_2", "OF_WT_3", "OF_WT_4", "OF_WT_5"]);
    expect(volume.every((o) => o.exclusiveGroup === "size_volume")).toBe(true);
    expect(weight.every((o) => o.exclusiveGroup === "size_weight")).toBe(true);
  });

  it("labels each volume bracket with exactly the limit the pricing code uses to place a volume in it", () => {
    for (const o of sizeOptions("FN_OTHER_FURNITURE", "size_volume")) {
      const labelled = Number(o.labelEn.match(/[\d.]+/)?.[0]);
      expect(labelled, o.code).toBe(VOLUME_BRACKET_MAX_M3[o.code]);
    }
  });

  it("labels every bracket in both languages with its unit", () => {
    expect(sizeOptions("FN_OTHER_FURNITURE", "size_volume")).toHaveLength(5);
    expect(sizeOptions("FN_OTHER_FURNITURE", "size_weight")).toHaveLength(5);
    for (const o of sizeOptions("FN_OTHER_FURNITURE", "size_volume")) {
      expect(o.labelEn).toMatch(/m³/);
      expect(o.labelNo).toMatch(/m³/);
    }
    for (const o of sizeOptions("FN_OTHER_FURNITURE", "size_weight")) {
      expect(o.labelEn).toMatch(/kg/);
      expect(o.labelNo).toMatch(/kg/);
    }
  });

  it("orders brackets from smallest to largest (labels get bigger)", () => {
    const numbers = (category: string) =>
      sizeOptions("FN_OTHER_FURNITURE", category).map((o) => Number(o.labelEn.match(/[\d.]+/)?.[0]));

    for (const category of ["size_volume", "size_weight"]) {
      const values = numbers(category);
      expect(values).toHaveLength(5);
      expect(values.every(Number.isFinite)).toBe(true);
      expect(values).toEqual([...values].sort((a, b) => a - b));
    }
  });

  it("ships priced at 0 kr and flagged staff-priced, so a reseed never wipes prices staff have entered", () => {
    const options = [...sizeOptions("FN_OTHER_FURNITURE", "size_volume"), ...sizeOptions("FN_OTHER_FURNITURE", "size_weight")];

    expect(options).toHaveLength(10);
    expect(options.every((o) => o.customerPrice === 0 && o.subcontractorPrice === 0)).toBe(true);
    expect(options.every((o) => o.staffPriced === true)).toBe(true);
  });

  it("keeps the flat delivery prices — the size charge is added on top", () => {
    expect(byCode("FN_OTHER_FURNITURE").deliveryTypes.firstStep.customerPrice).toBe(608.88);
    expect(byCode("FN_OTHER_FURNITURE").deliveryTypes.indoor.customerPrice).toBe(690.408);
  });

  it("no other furniture product has size brackets", () => {
    const others = FURNITURE_PRODUCTS.filter((p) => p.code !== "FN_OTHER_FURNITURE");
    expect(others.some((p) => p.options.some((o) => o.category.startsWith("size_")))).toBe(false);
  });
});

describe("order-level extras", () => {
  it("match the white-goods values the furniture source says it shares (express 516, floor 71.208, km 28.896)", () => {
    expect(WHITE_GOODS_ORDER_LEVEL_EXTRAS.expressDelivery.customerPrice).toBe(516);
    expect(WHITE_GOODS_ORDER_LEVEL_EXTRAS.floorSurcharge.customerPrice).toBeCloseTo(71.208);
    expect(WHITE_GOODS_ORDER_LEVEL_EXTRAS.kmFrom21.customerPrice).toBeCloseTo(28.896);
  });
});
