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
