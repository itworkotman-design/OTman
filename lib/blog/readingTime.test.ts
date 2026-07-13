import { describe, expect, it } from "vitest";
import { computeReadingTimeMinutes } from "./readingTime";
import type { BlogSectionData } from "./blogSectionSchemas";

const EMPTY = { en: "", no: "" };

describe("computeReadingTimeMinutes", () => {
  it("returns a minimum of 1 minute for empty content", () => {
    expect(computeReadingTimeMinutes([], "en")).toBe(1);
  });

  it("floors at 1 minute for very short content", () => {
    const sections: BlogSectionData[] = [{ type: "RICH_TEXT", html: { en: "hello world", no: "" } }];
    expect(computeReadingTimeMinutes(sections, "en")).toBe(1);
  });

  it("computes roughly words / 200 for long content", () => {
    const words = Array.from({ length: 800 }, () => "word").join(" ");
    const sections: BlogSectionData[] = [{ type: "RICH_TEXT", html: { en: `<p>${words}</p>`, no: "" } }];
    expect(computeReadingTimeMinutes(sections, "en")).toBe(4);
  });

  it("ignores divider and spacer sections", () => {
    const sections: BlogSectionData[] = [
      { type: "DIVIDER", style: "solid" },
      { type: "SPACER", size: "large" },
    ];
    expect(computeReadingTimeMinutes(sections, "en")).toBe(1);
  });

  it("computes locale-independent word counts", () => {
    const sections: BlogSectionData[] = [
      { type: "RICH_TEXT", html: { en: Array(400).fill("word").join(" "), no: Array(200).fill("ord").join(" ") } },
    ];
    expect(computeReadingTimeMinutes(sections, "en")).toBe(2);
    expect(computeReadingTimeMinutes(sections, "no")).toBe(1);
  });
});
