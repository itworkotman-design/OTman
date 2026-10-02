import { describe, expect, it } from "vitest";
import { parseFloorInput, sanitizeFloorText, stepFloor } from "./floorValue";

describe("sanitizeFloorText", () => {
  it("keeps digits and a single leading minus", () => {
    expect(sanitizeFloorText("3")).toBe("3");
    expect(sanitizeFloorText("-2")).toBe("-2");
    expect(sanitizeFloorText("-")).toBe("-");
    expect(sanitizeFloorText("")).toBe("");
  });

  it("drops letters, decimals, plus signs and any minus that isn't leading", () => {
    expect(sanitizeFloorText("3e")).toBe("3");
    expect(sanitizeFloorText("3.6")).toBe("36");
    expect(sanitizeFloorText("+4")).toBe("4");
    expect(sanitizeFloorText("1-2")).toBe("12");
    expect(sanitizeFloorText("--1")).toBe("-1");
    expect(sanitizeFloorText("abc")).toBe("");
  });

  it("drops leading zeros, since there is no floor 0", () => {
    expect(sanitizeFloorText("0")).toBe("");
    expect(sanitizeFloorText("-0")).toBe("-");
    expect(sanitizeFloorText("05")).toBe("5");
    expect(sanitizeFloorText("10")).toBe("10");
  });

  it("caps the number at 3 digits", () => {
    expect(sanitizeFloorText("1234")).toBe("123");
    expect(sanitizeFloorText("-1234")).toBe("-123");
  });
});

describe("parseFloorInput", () => {
  it("reads a whole floor above or below ground", () => {
    expect(parseFloorInput("1")).toBe(1);
    expect(parseFloorInput("7")).toBe(7);
    expect(parseFloorInput("-1")).toBe(-1);
    expect(parseFloorInput("-3")).toBe(-3);
  });

  it("treats an empty box, a lone minus, 0 or non-numbers as not chosen", () => {
    expect(parseFloorInput("")).toBeNull();
    expect(parseFloorInput("-")).toBeNull();
    expect(parseFloorInput("0")).toBeNull();
    expect(parseFloorInput("abc")).toBeNull();
  });
});

describe("stepFloor", () => {
  it("starts at the ground floor (1) from nothing chosen", () => {
    expect(stepFloor(null, 1)).toBe(1);
    expect(stepFloor(null, -1)).toBe(1);
  });

  it("steps up and down", () => {
    expect(stepFloor(3, 1)).toBe(4);
    expect(stepFloor(3, -1)).toBe(2);
    expect(stepFloor(-2, -1)).toBe(-3);
    expect(stepFloor(-2, 1)).toBe(-1);
  });

  it("skips floor 0 between the ground floor and the basement", () => {
    expect(stepFloor(1, -1)).toBe(-1);
    expect(stepFloor(-1, 1)).toBe(1);
  });
});
