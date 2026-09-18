import { describe, expect, it } from "vitest";
import { resolveProductIconKey } from "./productIconKey";

describe("resolveProductIconKey", () => {
  it("uses the product's own iconKey when set", () => {
    expect(resolveProductIconKey("WG_WASHING_MACHINE", "custom_icon")).toBe("custom_icon");
  });

  it("derives a key from the code by stripping the WG_ prefix and lowercasing", () => {
    expect(resolveProductIconKey("WG_WASHING_MACHINE")).toBe("washing_machine");
    expect(resolveProductIconKey("WG_DISHWASHER", null)).toBe("dishwasher");
  });

  it("treats an empty-string iconKey as unset and falls back to the code", () => {
    expect(resolveProductIconKey("WG_OVEN", "")).toBe("oven");
  });

  it("lowercases codes with no WG_ prefix as-is", () => {
    expect(resolveProductIconKey("SOME_CODE")).toBe("some_code");
  });
});
