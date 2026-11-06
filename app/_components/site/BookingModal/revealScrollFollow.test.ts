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

// e.g. an added category removed again: the remaining category's "any other
// products?" question sits at the end of its options step, so that end is
// brought into view — also by scrolling up, out of the blank space the removed
// steps leave while the height is held.
describe("followRevealedSection — align: end", () => {
  let top = 0;
  const end: number[] = [];
  const followEnd = (section: { top: number; bottom: number }) =>
    followRevealedSection({
      measure: () => ({ scrollTop: top, viewportHeight: 600, sectionTop: section.top, sectionBottom: section.bottom }),
      scrollTo: (next) => {
        end.push(next);
        top = next;
      },
      observe: () => () => {},
      setTimer: () => () => {},
      padding: 24,
      align: "end",
    });

  beforeEach(() => {
    end.length = 0;
  });

  it("scrolls down until the section's end is in view, even when its top would leave the screen", () => {
    top = 1000;
    followEnd({ top: 200, bottom: 1800 });
    expect(end).toEqual([1224]);
  });

  it("scrolls up when the view is below the section's end", () => {
    top = 1700;
    followEnd({ top: 200, bottom: 1800 });
    expect(end).toEqual([1224]);
  });

  it("stays put when the end is already where it belongs", () => {
    top = 1224;
    followEnd({ top: 200, bottom: 1800 });
    expect(end).toEqual([]);
  });

  it("never scrolls above the top of the scroll area", () => {
    top = 300;
    followEnd({ top: 0, bottom: 400 });
    expect(end).toEqual([0]);
  });
});
