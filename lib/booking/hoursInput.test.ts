import { describe, expect, it } from "vitest";
import { normalizeHoursInput, parseHoursInputDraft, sanitizeHoursInputDraft } from "./hoursInput";

describe("sanitizeHoursInputDraft", () => {
  it("keeps digits and a single decimal separator", () => {
    expect(sanitizeHoursInputDraft("1.25")).toBe("1.25");
    expect(sanitizeHoursInputDraft("1,5")).toBe("1,5");
    expect(sanitizeHoursInputDraft("")).toBe("");
  });

  it("strips anything that is not a digit or separator", () => {
    expect(sanitizeHoursInputDraft("-1e2+")).toBe("12");
    expect(sanitizeHoursInputDraft("1 t")).toBe("1");
    expect(sanitizeHoursInputDraft("abc")).toBe("");
  });

  it("drops extra separators after the first", () => {
    expect(sanitizeHoursInputDraft("1.2.5")).toBe("1.25");
    expect(sanitizeHoursInputDraft("1,2.5")).toBe("1,25");
  });
});

describe("normalizeHoursInput", () => {
  it("keeps quarter-hour values", () => {
    expect(normalizeHoursInput(0.25)).toBe(0.25);
    expect(normalizeHoursInput(0.75)).toBe(0.75);
    expect(normalizeHoursInput(2.5)).toBe(2.5);
  });

  it("snaps to the nearest 15 minutes", () => {
    expect(normalizeHoursInput(1.1)).toBe(1);
    expect(normalizeHoursInput(1.13)).toBe(1.25);
    expect(normalizeHoursInput(1.4)).toBe(1.5);
  });

  it("never goes below 15 minutes", () => {
    expect(normalizeHoursInput(0)).toBe(0.25);
    expect(normalizeHoursInput(0.1)).toBe(0.25);
    expect(normalizeHoursInput(-3)).toBe(0.25);
  });

  it("falls back to 1 hour for missing/invalid values", () => {
    expect(normalizeHoursInput(undefined)).toBe(1);
    expect(normalizeHoursInput(Number.NaN)).toBe(1);
  });
});

describe("parseHoursInputDraft", () => {
  it("parses dot and comma decimals", () => {
    expect(parseHoursInputDraft("1.25")).toBe(1.25);
    expect(parseHoursInputDraft("1,75")).toBe(1.75);
  });

  it("returns null for empty or unparseable text", () => {
    expect(parseHoursInputDraft("")).toBeNull();
    expect(parseHoursInputDraft("  ")).toBeNull();
    expect(parseHoursInputDraft(",")).toBeNull();
    expect(parseHoursInputDraft("abc")).toBeNull();
  });
});
