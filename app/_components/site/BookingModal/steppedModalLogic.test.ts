import { describe, expect, it } from "vitest";
import {
  heightHoldAction,
  nextRevealedCount,
  progressPercent,
  showsBottomSpace,
  retractedRevealedCount,
  retractedSectionIndices,
  shownSectionIds,
  structureGainedSections,
  withExitingItems,
} from "./steppedModalLogic";

describe("shownSectionIds", () => {
  it("lists the sections on screen and leaves out hidden ones", () => {
    expect(shownSectionIds([{ id: "a" }, { id: "b", hidden: true }, { id: "c" }])).toEqual(["a", "c"]);
  });
});

describe("structureGainedSections", () => {
  const base = { ids: ["a", "b"], showFinalStep: false };

  it("is true when a section appears, e.g. revealed or un-hidden", () => {
    expect(structureGainedSections(base, { ids: ["a", "b", "c"], showFinalStep: false })).toBe(true);
    expect(structureGainedSections(base, { ids: ["a", "c"], showFinalStep: false })).toBe(true);
  });

  it("is false when sections only leave", () => {
    expect(structureGainedSections(base, { ids: ["a"], showFinalStep: false })).toBe(false);
    expect(structureGainedSections(base, { ids: [], showFinalStep: false })).toBe(false);
  });

  it("is true when the final step is entered or left, since the whole body swaps", () => {
    expect(structureGainedSections(base, { ids: ["a", "b"], showFinalStep: true })).toBe(true);
    expect(structureGainedSections({ ...base, showFinalStep: true }, base)).toBe(true);
  });
});

describe("heightHoldAction", () => {
  it("holds the old height while a newly added section animates open", () => {
    expect(heightHoldAction({ gained: true, holdPending: false })).toBe("hold-then-release");
  });

  // Sections that only leave fade and collapse on their own, so the height
  // doesn't need holding.
  it("does nothing when sections only leave and no hold is running", () => {
    expect(heightHoldAction({ gained: false, holdPending: false })).toBe("none");
  });

  // Adding a category swaps the "any other products?" step for a new, collapsed
  // one, whose auto-advance immediately retracts the steps after it. That
  // must not cut the hold short, or the scroll position clamps upward to the
  // new section's top edge.
  it("keeps holding when sections leave while an earlier hold is still pending", () => {
    expect(heightHoldAction({ gained: false, holdPending: true })).toBe("keep-holding");
  });

  it("restarts the hold when another section is added during a pending hold", () => {
    expect(heightHoldAction({ gained: true, holdPending: true })).toBe("hold-then-release");
  });
});

describe("withExitingItems", () => {
  const item = (key: string) => ({ key });
  const keys = (items: { key: string }[]) => items.map((i) => i.key);

  it("returns the current items when nothing left", () => {
    expect(keys(withExitingItems([item("a"), item("b")], [item("a"), item("b")]))).toEqual(["a", "b"]);
  });

  it("keeps an item that left in its old position so it can animate out", () => {
    expect(keys(withExitingItems([item("a"), item("b"), item("c")], [item("a"), item("c")]))).toEqual(["a", "b", "c"]);
    expect(keys(withExitingItems([item("a"), item("b")], [item("b")]))).toEqual(["a", "b"]);
  });

  it("keeps several consecutive leavers in order", () => {
    expect(keys(withExitingItems([item("a"), item("b"), item("c"), item("d")], [item("a"), item("d")]))).toEqual(["a", "b", "c", "d"]);
  });

  it("puts a leaver after the item it followed when that item was replaced", () => {
    expect(keys(withExitingItems([item("a"), item("more")], [item("a"), item("newProducts")]))).toEqual(["a", "more", "newProducts"]);
  });

  it("uses the current version of items that are still present", () => {
    const next = { key: "a", v: 2 };
    expect(withExitingItems([{ key: "a", v: 1 }], [next])[0]).toBe(next);
  });
});

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

describe("retractedRevealedCount", () => {
  it("hides every section after the one that stopped being satisfied", () => {
    expect(retractedRevealedCount(4, 1)).toBe(2);
  });

  it("is a no-op if nothing past that section was revealed yet", () => {
    expect(retractedRevealedCount(2, 1)).toBe(2);
    expect(retractedRevealedCount(1, 1)).toBe(1);
  });

  it("keeps the section itself visible, only retracting what comes after it", () => {
    expect(retractedRevealedCount(5, 0)).toBe(1);
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

describe("retractedSectionIndices", () => {
  it("lists the revealed sections after the one that stopped being satisfied", () => {
    expect(retractedSectionIndices(5, 1)).toEqual([2, 3, 4]);
  });

  it("is empty when nothing was revealed after it", () => {
    expect(retractedSectionIndices(3, 2)).toEqual([]);
    expect(retractedSectionIndices(2, 4)).toEqual([]);
  });
});

describe("showsBottomSpace", () => {
  it("is true when the last shown section asks for it", () => {
    expect(showsBottomSpace([{ id: "a" }, { id: "pickup", bottomSpace: true }])).toBe(true);
  });

  it("is false once a later section is revealed after it", () => {
    expect(showsBottomSpace([{ id: "pickup", bottomSpace: true }, { id: "details" }])).toBe(false);
  });

  it("skips hidden sections when finding the last shown one", () => {
    expect(showsBottomSpace([{ id: "pickup", bottomSpace: true }, { id: "opts", hidden: true }])).toBe(true);
  });

  it("is false with no sections", () => {
    expect(showsBottomSpace([])).toBe(false);
  });
});
