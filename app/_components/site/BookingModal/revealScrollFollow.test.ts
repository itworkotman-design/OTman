import { beforeEach, describe, expect, it } from "vitest";
import { REVEAL_FOLLOW_MS, followRevealedSection } from "./revealScrollFollow";

// A fake scroll area: 600px tall, the section starts at 500px.
let scrollTop = 0;
let sectionHeight = 50;
let onResize: (() => void) | null = null;
let disconnected = false;
let timer: (() => void) | null = null;
const scrolls: number[] = [];

const follow = () =>
  followRevealedSection({
    measure: () => ({ scrollTop, viewportHeight: 600, sectionTop: 500, sectionBottom: 500 + sectionHeight }),
    scrollTo: (top) => {
      scrolls.push(top);
      scrollTop = top;
    },
    observe: (callback) => {
      onResize = callback;
      return () => {
        disconnected = true;
      };
    },
    setTimer: (callback, ms) => {
      expect(ms).toBe(REVEAL_FOLLOW_MS);
      timer = callback;
      return () => {
        timer = null;
      };
    },
    padding: 24,
  });

describe("followRevealedSection — scrolling to a section that is still loading", () => {
  beforeEach(() => {
    scrollTop = 0;
    sectionHeight = 50;
    onResize = null;
    disconnected = false;
    timer = null;
    scrolls.length = 0;
  });

  it("doesn't scroll while the just-opened section already fits on screen", () => {
    follow();
    expect(scrolls).toEqual([]);
  });

  it("scrolls once its content arrives and it grows past the bottom (data loaded after it opened)", () => {
    follow();
    sectionHeight = 400;
    onResize!();
    expect(scrolls).toEqual([500 + 400 + 24 - 600]);
  });

  it("stops following after a while", () => {
    follow();
    timer!();
    expect(disconnected).toBe(true);
    sectionHeight = 400;
    onResize?.();
    expect(scrolls).toEqual([]);
  });

  it("stops following when cancelled (the user scrolled, or the next section opened)", () => {
    const cancel = follow();
    cancel();
    expect(disconnected).toBe(true);
    expect(timer).toBeNull();
    sectionHeight = 400;
    onResize?.();
    expect(scrolls).toEqual([]);
  });
});
