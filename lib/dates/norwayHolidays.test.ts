import { describe, expect, it } from "vitest";
import { isNorwegianPublicHoliday } from "./norwayHolidays";

describe("isNorwegianPublicHoliday — fixed dates", () => {
  it("flags New Year's Day, Labour Day, Constitution Day, and both Christmas days", () => {
    expect(isNorwegianPublicHoliday("2026-01-01")).toBe(true);
    expect(isNorwegianPublicHoliday("2026-05-01")).toBe(true);
    expect(isNorwegianPublicHoliday("2026-05-17")).toBe(true);
    expect(isNorwegianPublicHoliday("2026-12-25")).toBe(true);
    expect(isNorwegianPublicHoliday("2026-12-26")).toBe(true);
  });
});

describe("isNorwegianPublicHoliday — Easter-anchored dates", () => {
  it("2024 (Easter Sunday = March 31, 2024)", () => {
    expect(isNorwegianPublicHoliday("2024-03-28")).toBe(true); // Maundy Thursday
    expect(isNorwegianPublicHoliday("2024-03-29")).toBe(true); // Good Friday
    expect(isNorwegianPublicHoliday("2024-03-31")).toBe(true); // Easter Sunday
    expect(isNorwegianPublicHoliday("2024-04-01")).toBe(true); // Easter Monday
    expect(isNorwegianPublicHoliday("2024-05-09")).toBe(true); // Ascension Day
    expect(isNorwegianPublicHoliday("2024-05-19")).toBe(true); // Whit Sunday
    expect(isNorwegianPublicHoliday("2024-05-20")).toBe(true); // Whit Monday
  });

  it("2025 (Easter Sunday = April 20, 2025)", () => {
    expect(isNorwegianPublicHoliday("2025-04-17")).toBe(true); // Maundy Thursday
    expect(isNorwegianPublicHoliday("2025-04-18")).toBe(true); // Good Friday
    expect(isNorwegianPublicHoliday("2025-04-20")).toBe(true); // Easter Sunday
    expect(isNorwegianPublicHoliday("2025-04-21")).toBe(true); // Easter Monday
    expect(isNorwegianPublicHoliday("2025-05-29")).toBe(true); // Ascension Day
    expect(isNorwegianPublicHoliday("2025-06-08")).toBe(true); // Whit Sunday
    expect(isNorwegianPublicHoliday("2025-06-09")).toBe(true); // Whit Monday
  });

  it("2026 (Easter Sunday = April 5, 2026)", () => {
    expect(isNorwegianPublicHoliday("2026-04-02")).toBe(true); // Maundy Thursday
    expect(isNorwegianPublicHoliday("2026-04-03")).toBe(true); // Good Friday
    expect(isNorwegianPublicHoliday("2026-04-05")).toBe(true); // Easter Sunday
    expect(isNorwegianPublicHoliday("2026-04-06")).toBe(true); // Easter Monday
    expect(isNorwegianPublicHoliday("2026-05-14")).toBe(true); // Ascension Day
    expect(isNorwegianPublicHoliday("2026-05-24")).toBe(true); // Whit Sunday
    expect(isNorwegianPublicHoliday("2026-05-25")).toBe(true); // Whit Monday
  });
});

describe("isNorwegianPublicHoliday — non-holidays", () => {
  it("returns false for an ordinary weekday", () => {
    expect(isNorwegianPublicHoliday("2026-09-30")).toBe(false);
  });

  it("returns false for the day right before/after a holiday", () => {
    expect(isNorwegianPublicHoliday("2026-12-24")).toBe(false);
    expect(isNorwegianPublicHoliday("2026-12-27")).toBe(false);
  });

  it("is stable across repeated calls for the same year (cache doesn't leak between years)", () => {
    expect(isNorwegianPublicHoliday("2024-05-01")).toBe(true);
    expect(isNorwegianPublicHoliday("2025-05-01")).toBe(true);
    expect(isNorwegianPublicHoliday("2024-05-02")).toBe(false);
  });
});
