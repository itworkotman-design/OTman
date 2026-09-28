import { describe, expect, it } from "vitest";
import { getTileKeyframes } from "./tileMotion";

describe("getTileKeyframes", () => {
  it("returns null when the tile did not move or change width", () => {
    expect(getTileKeyframes({ left: 10, top: 20, width: 100 }, { left: 10, top: 20, width: 100 })).toBeNull();
    // sub-pixel noise is not worth animating
    expect(getTileKeyframes({ left: 10, top: 20, width: 100 }, { left: 10.4, top: 20.3, width: 100.5 })).toBeNull();
  });

  it("starts a moved tile at its old position and ends at rest", () => {
    const frames = getTileKeyframes({ left: 0, top: 0, width: 100 }, { left: 120, top: 80, width: 100 });
    expect(frames).toEqual([{ transform: "translate(-120px, -80px)" }, { transform: "translate(0, 0)" }]);
  });

  it("also animates the width when the tile grew to the full row", () => {
    const frames = getTileKeyframes({ left: 0, top: 0, width: 150 }, { left: 0, top: 0, width: 600 });
    expect(frames).toEqual([
      { transform: "translate(0px, 0px)", width: "150px" },
      { transform: "translate(0, 0)", width: "600px" },
    ]);
  });

  it("animates the width back down when the tile collapses", () => {
    const frames = getTileKeyframes({ left: 0, top: 0, width: 600 }, { left: 300, top: 0, width: 150 });
    expect(frames?.[0]).toMatchObject({ transform: "translate(-300px, 0px)", width: "600px" });
    expect(frames?.[1]).toMatchObject({ width: "150px" });
  });
});
