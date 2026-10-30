import { describe, expect, it } from "vitest";
import { getCopyText } from "./copyText";

describe("getCopyText", () => {
  it("returns trimmed text for non-empty strings and numbers", () => {
    expect(getCopyText("  Storgata 1, Oslo ")).toBe("Storgata 1, Oslo");
    expect(getCopyText(1234)).toBe("1234");
    expect(getCopyText(0)).toBe("0");
  });

  it("returns null when there is nothing to copy", () => {
    expect(getCopyText(null)).toBeNull();
    expect(getCopyText(undefined)).toBeNull();
    expect(getCopyText("   ")).toBeNull();
    expect(getCopyText("-")).toBeNull();
  });
});
