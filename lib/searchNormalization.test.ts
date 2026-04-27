import { describe, expect, it } from "vitest";
import { normalizedIncludes, normalizeSearchText } from "./searchNormalization";

describe("search normalization", () => {
  it("lowercases text and removes whitespace", () => {
    expect(normalizeSearchText("  Power GRUNER Lokka  ")).toBe(
      "powergrunerlokka",
    );
  });

  it("matches emails and numbers without caring about case or spaces", () => {
    expect(
      normalizedIncludes("CUSTOMER@Example.COM", "customer@example.com"),
    ).toBe(true);
    expect(normalizedIncludes("+47 98 76 54 32", "+4798765432")).toBe(true);
  });
});
