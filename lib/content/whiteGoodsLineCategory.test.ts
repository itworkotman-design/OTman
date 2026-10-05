import { describe, expect, it } from "vitest";
import { categorizeWhiteGoodsLineCode } from "./whiteGoodsLineCategory";

describe("categorizeWhiteGoodsLineCode", () => {
  it("treats the delivery-type codes as delivery lines", () => {
    expect(categorizeWhiteGoodsLineCode("FIRST_STEP")).toBe("delivery");
    expect(categorizeWhiteGoodsLineCode("INDOOR")).toBe("delivery");
  });

  it("treats a product's install-type option code as an install line", () => {
    expect(categorizeWhiteGoodsLineCode("DISHWASHER_STANDARD_WETROOM")).toBe("install");
    expect(categorizeWhiteGoodsLineCode("WASHING_MACHINE_APPROVED_WETROOM")).toBe("install");
  });

  it("knows the short codes, and still the old long ones that past orders' lines carry", () => {
    expect(categorizeWhiteGoodsLineCode("DISHWASHER_STD_WET")).toBe("install");
    expect(categorizeWhiteGoodsLineCode("ASM_SGL_BED_IKEA")).toBe("install");
    expect(categorizeWhiteGoodsLineCode("DISMANTLE_DISP_SGL_BED")).toBe("other");
  });

  it("treats the shared add-on/return codes as other lines", () => {
    expect(categorizeWhiteGoodsLineCode("UNPACKING")).toBe("other");
    expect(categorizeWhiteGoodsLineCode("DEMONT")).toBe("other");
    expect(categorizeWhiteGoodsLineCode("RETURN_RECYCLING")).toBe("other");
  });

  it("falls back to other for an unknown or missing code", () => {
    expect(categorizeWhiteGoodsLineCode("SOMETHING_UNKNOWN")).toBe("other");
    expect(categorizeWhiteGoodsLineCode(undefined)).toBe("other");
  });
});

describe("categorizeWhiteGoodsLineCode: extra delivery", () => {
  it("treats the XTRA (extra delivery) code as a delivery line", () => {
    expect(categorizeWhiteGoodsLineCode("XTRA")).toBe("delivery");
  });
});

describe("categorizeWhiteGoodsLineCode: furniture", () => {
  it("treats furniture assembly options as install lines and furniture add-ons as other", () => {
    expect(categorizeWhiteGoodsLineCode("ASM_SINGLE_BED_IKEA")).toBe("install");
    expect(categorizeWhiteGoodsLineCode("DISMANTLE_DISPOSAL_SINGLE_BED")).toBe("other");
    expect(categorizeWhiteGoodsLineCode("WALL_ANCHORING")).toBe("other");
  });
});
