import { describe, expect, it } from "vitest";
import { nextRevealedCount, progressPercent } from "./steppedModalLogic";

describe("nextRevealedCount", () => {
  it("reveals the next section when the current one completes", () => {
    expect(nextRevealedCount(1, 0, 4)).toBe(2);
    expect(nextRevealedCount(2, 1, 4)).toBe(3);
  });

  it("never decreases the revealed count when an earlier section is re-completed", () => {
    expect(nextRevealedCount(3, 0, 4)).toBe(3);
  });

  it("never reveals past the total number of sections", () => {
    expect(nextRevealedCount(4, 3, 4)).toBe(4);
  });

  it("stays put if the same section completes again without new sections after it", () => {
    expect(nextRevealedCount(4, 2, 4)).toBe(4);
  });
});

describe("progressPercent", () => {
  it("scales revealed sections to a 0-100 fill", () => {
    expect(progressPercent(1, 4)).toBe(25);
    expect(progressPercent(2, 4)).toBe(50);
    expect(progressPercent(4, 4)).toBe(100);
  });

  it("never exceeds 100 even if revealedCount overshoots", () => {
    expect(progressPercent(5, 4)).toBe(100);
  });

  it("treats zero sections as an empty bar instead of dividing by zero", () => {
    expect(progressPercent(0, 0)).toBe(0);
  });
});
