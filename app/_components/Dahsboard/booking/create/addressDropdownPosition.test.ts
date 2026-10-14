import { describe, expect, it } from "vitest";
import { addressDropdownPosition } from "./addressDropdownPosition";

// The input's on-screen box (getBoundingClientRect) and the viewport height.
const input = (top: number, height = 48) => ({ top, bottom: top + height, left: 100, width: 400 });

describe("addressDropdownPosition", () => {
  it("opens below the input, matching its width, 4px under it", () => {
    expect(addressDropdownPosition(input(100), 900)).toEqual({ left: 100, width: 400, top: 152, maxHeight: 288 });
  });

  it("shrinks to the room left below rather than running off screen", () => {
    // 600 - 352 (its top) - 8 (edge margin) = 240
    expect(addressDropdownPosition(input(300), 600)).toMatchObject({ top: 352, maxHeight: 240 });
  });

  it("opens above when there's too little room below and more above", () => {
    const pos = addressDropdownPosition(input(700), 800);
    expect(pos.bottom).toBe(800 - 700 + 4);
    expect(pos.top).toBeUndefined();
    expect(pos.maxHeight).toBe(288);
  });
});
