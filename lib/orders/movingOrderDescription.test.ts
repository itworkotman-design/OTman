import { describe, expect, it } from "vitest";
import { movingOrderDescription, parseMovingFloors } from "./movingOrderDescription";

describe("parseMovingFloors", () => {
  it("defaults to null when not sent (older clients)", () => {
    expect(parseMovingFloors(undefined)).toEqual({ ok: true, floors: null });
    expect(parseMovingFloors(null)).toEqual({ ok: true, floors: null });
  });

  it("accepts whole numbers from 1 to 4", () => {
    expect(parseMovingFloors(1)).toEqual({ ok: true, floors: 1 });
    expect(parseMovingFloors(4)).toEqual({ ok: true, floors: 4 });
  });

  it("rejects anything else", () => {
    expect(parseMovingFloors(0).ok).toBe(false);
    expect(parseMovingFloors(5).ok).toBe(false);
    expect(parseMovingFloors(1.5).ok).toBe(false);
    expect(parseMovingFloors("2").ok).toBe(false);
  });
});

describe("movingOrderDescription", () => {
  it("lists size, floors and notes", () => {
    expect(movingOrderDescription({ sizeLabel: "Under 40 m²", floors: 2, notes: "No lift" })).toBe(
      "Approximate size: Under 40 m²\n\nFloors: 2\n\nNo lift",
    );
  });

  it("leaves out floors and notes when missing", () => {
    expect(movingOrderDescription({ sizeLabel: "Under 40 m²", floors: null, notes: null })).toBe(
      "Approximate size: Under 40 m²",
    );
  });
});
