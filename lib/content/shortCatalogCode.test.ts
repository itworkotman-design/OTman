import { describe, expect, it } from "vitest";
import { shortenCatalogCode } from "./shortCatalogCode";
import { FURNITURE_PRODUCTS } from "./furnitureCatalog";
import { WHITE_GOODS_ELECTRONICS_PRODUCTS as WHITE_GOODS_PRODUCTS } from "./whiteGoodsElectronics";
import { PARCEL_PALLET_PRODUCTS } from "./parcelPalletCatalog";

const ALL_PRODUCTS = [...WHITE_GOODS_PRODUCTS, ...FURNITURE_PRODUCTS, ...PARCEL_PALLET_PRODUCTS];

describe("shortenCatalogCode", () => {
  it("abbreviates the describing words, one dictionary for every catalog", () => {
    expect(shortenCatalogCode("DISMANTLE_CAREFUL_LARGE_7_DRAWERS")).toBe("DISMANTLE_CAR_LG_7_DRW");
    expect(shortenCatalogCode("DISMANTLE_DISPOSAL_SMALL_UP_TO_3_DRAWERS")).toBe("DISMANTLE_DISP_SM_MAX_3_DRW");
    expect(shortenCatalogCode("ASM_STANDARD_WARDROBE_HINGED_DOORS_OTHER_MANUFACTURER")).toBe("ASM_STD_WARDROBE_HNG_DR_OTHER");
    expect(shortenCatalogCode("ASM_MODULAR_WARDROBE_3_4_SECTIONS_A_MOBLER")).toBe("ASM_MOD_WARDROBE_3_4_SEC_AMOBLER");
    expect(shortenCatalogCode("ASM_DESK_WITH_DRAWERS_STORAGE_AJ_PRODUKTER")).toBe("ASM_DESK_W_DRW_STOR_AJ");
    expect(shortenCatalogCode("UPRIGHT_FREEZER_INTEGRATED_FRONT_EXCLUDED")).toBe("UPRIGHT_FREEZER_INT_NOFP");
    expect(shortenCatalogCode("FRIDGE_FREEZER_REHANG_DOOR_BEFORE")).toBe("FRIDGE_FREEZER_REHANG_PRE");
    expect(shortenCatalogCode("WASHING_MACHINE_NON_APPROVED_WETROOM")).toBe("WASHING_MACHINE_NONAPPR_WET");
  });

  it("keeps the main words and product names", () => {
    for (const code of [
      "UNPACKING",
      "DEMONT",
      "RETURN_RECYCLING",
      "WALL_ANCHORING",
      "PALLET_PICKUP",
      "COOKER_INSTALL_PLUG",
      "TV_MOUNT_STAND_75_100",
      "TV_TABLE_UNDER_55",
      "ASM_DAYBED_IKEA",
      "OF_WT_1",
    ]) {
      expect(shortenCatalogCode(code)).toBe(code);
    }
  });

  it("is stable: a short code stays as it is", () => {
    for (const product of ALL_PRODUCTS) {
      for (const option of product.options) {
        expect(shortenCatalogCode(option.code)).toBe(option.code);
      }
    }
  });
});

describe("seeded option codes", () => {
  it("are all short (at most 35 characters, was 55)", () => {
    const long = ALL_PRODUCTS.flatMap((p) => p.options.map((o) => o.code)).filter((code) => code.length > 35);
    expect(long).toEqual([]);
  });

  it("are still unique within each product", () => {
    for (const product of ALL_PRODUCTS) {
      const codes = product.options.map((o) => o.code);
      expect(new Set(codes).size, product.code).toBe(codes.length);
    }
  });
});
