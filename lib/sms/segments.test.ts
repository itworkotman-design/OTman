import { describe, expect, it } from "vitest";
import { countSmsSegments } from "./segments";

describe("countSmsSegments", () => {
  it("counts plain GSM-7 text (Norwegian letters included) at 160/153 per segment", () => {
    expect(countSmsSegments("")).toEqual({ characters: 0, segments: 0, unicode: false });
    expect(countSmsSegments("Hei på deg, Ærlig Øystein!")).toEqual({ characters: 26, segments: 1, unicode: false });
    expect(countSmsSegments("a".repeat(160)).segments).toBe(1);
    expect(countSmsSegments("a".repeat(161)).segments).toBe(2);
    expect(countSmsSegments("a".repeat(306)).segments).toBe(2);
    expect(countSmsSegments("a".repeat(307)).segments).toBe(3);
  });

  it("counts GSM-7 extension characters as two", () => {
    expect(countSmsSegments("€".repeat(80))).toEqual({ characters: 160, segments: 1, unicode: false });
    expect(countSmsSegments("€".repeat(81)).segments).toBe(2);
  });

  it("switches to UCS-2 (70/67 per segment) for characters outside GSM-7", () => {
    expect(countSmsSegments("Hei 😀")).toMatchObject({ unicode: true, segments: 1 });
    expect(countSmsSegments("ś".repeat(70)).segments).toBe(1);
    expect(countSmsSegments("ś".repeat(71)).segments).toBe(2);
    expect(countSmsSegments("ś".repeat(135)).segments).toBe(3);
  });
});
