import { describe, expect, it } from "vitest";
import { hasEnglishDescriptionColumn } from "./englishDescription";

describe("hasEnglishDescriptionColumn", () => {
  it("is true for price lists whose name contains 'Website', in any casing", () => {
    expect(hasEnglishDescriptionColumn("Website — White goods / electronics")).toBe(true);
    expect(hasEnglishDescriptionColumn("website")).toBe(true);
    expect(hasEnglishDescriptionColumn("Power WEBSITE list")).toBe(true);
  });

  it("is false for every other price list, and when the name is missing", () => {
    expect(hasEnglishDescriptionColumn("Default")).toBe(false);
    expect(hasEnglishDescriptionColumn("Power")).toBe(false);
    expect(hasEnglishDescriptionColumn("")).toBe(false);
    expect(hasEnglishDescriptionColumn(null)).toBe(false);
    expect(hasEnglishDescriptionColumn(undefined)).toBe(false);
  });
});
