import { describe, expect, it } from "vitest";
import { parseFloorInput, stepFloor } from "./floorValue";

describe("parseFloorInput", () => {
  it("reads a whole floor of 1 or more", () => {
    expect(parseFloorInput("1")).toBe(1);
    expect(parseFloorInput("7")).toBe(7);
    expect(parseFloorInput("3.6")).toBe(3);
  });

  it("treats an empty box, 0 or anything below as not chosen", () => {
    expect(parseFloorInput("")).toBeNull();
    expect(parseFloorInput("0")).toBeNull();
    expect(parseFloorInput("-2")).toBeNull();
    expect(parseFloorInput("abc")).toBeNull();
  });
});

describe("stepFloor", () => {
  it("starts at the ground floor (1) from nothing chosen", () => {
    expect(stepFloor(null, 1)).toBe(1);
    expect(stepFloor(null, -1)).toBe(1);
  });

  it("steps up and down but never below 1", () => {
    expect(stepFloor(3, 1)).toBe(4);
    expect(stepFloor(3, -1)).toBe(2);
    expect(stepFloor(1, -1)).toBe(1);
  });
});
