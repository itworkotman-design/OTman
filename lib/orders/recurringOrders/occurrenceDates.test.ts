import { describe, expect, it } from "vitest";
import { computeUpcomingOccurrenceDates, isRecurrenceConfigValid, matchesRecurrence } from "./occurrenceDates";

describe("isRecurrenceConfigValid", () => {
  it("validates WEEKLY config", () => {
    expect(isRecurrenceConfigValid("WEEKLY", { weekdays: [1, 3] })).toBe(true);
    expect(isRecurrenceConfigValid("WEEKLY", { weekdays: [] })).toBe(false);
    expect(isRecurrenceConfigValid("WEEKLY", { weekdays: [7] })).toBe(false);
    expect(isRecurrenceConfigValid("WEEKLY", {})).toBe(false);
  });

  it("validates MONTHLY config", () => {
    expect(isRecurrenceConfigValid("MONTHLY", { dayOfMonth: 15 })).toBe(true);
    expect(isRecurrenceConfigValid("MONTHLY", { dayOfMonth: 0 })).toBe(false);
    expect(isRecurrenceConfigValid("MONTHLY", { dayOfMonth: 32 })).toBe(false);
  });

  it("validates CUSTOM_DATES config", () => {
    expect(isRecurrenceConfigValid("CUSTOM_DATES", { dates: ["2026-07-06"] })).toBe(true);
    expect(isRecurrenceConfigValid("CUSTOM_DATES", { dates: [] })).toBe(false);
    expect(isRecurrenceConfigValid("CUSTOM_DATES", { dates: ["not-a-date"] })).toBe(false);
  });
});

describe("matchesRecurrence", () => {
  it("matches WEEKLY on the configured weekdays", () => {
    // 2026-07-06 is a Monday (weekday 1).
    expect(matchesRecurrence("2026-07-06", "WEEKLY", { weekdays: [1] })).toBe(true);
    expect(matchesRecurrence("2026-07-06", "WEEKLY", { weekdays: [2] })).toBe(false);
  });

  it("matches MONTHLY on the configured day", () => {
    expect(matchesRecurrence("2026-07-15", "MONTHLY", { dayOfMonth: 15 })).toBe(true);
    expect(matchesRecurrence("2026-07-16", "MONTHLY", { dayOfMonth: 15 })).toBe(false);
  });

  it("clamps MONTHLY day-of-month to the last day of shorter months", () => {
    // February 2026 has 28 days; a template for "day 31" should fire on the 28th.
    expect(matchesRecurrence("2026-02-28", "MONTHLY", { dayOfMonth: 31 })).toBe(true);
    expect(matchesRecurrence("2026-01-31", "MONTHLY", { dayOfMonth: 31 })).toBe(true);
  });

  it("matches CUSTOM_DATES only on listed dates", () => {
    expect(matchesRecurrence("2026-07-06", "CUSTOM_DATES", { dates: ["2026-07-06"] })).toBe(true);
    expect(matchesRecurrence("2026-07-07", "CUSTOM_DATES", { dates: ["2026-07-06"] })).toBe(false);
  });

  it("returns false for malformed config", () => {
    expect(matchesRecurrence("2026-07-06", "WEEKLY", {})).toBe(false);
    expect(matchesRecurrence("2026-07-06", "WEEKLY", null)).toBe(false);
  });
});

describe("computeUpcomingOccurrenceDates", () => {
  it("collects the next N matching weekly dates from a start date", () => {
    const dates = computeUpcomingOccurrenceDates(
      {
        recurrenceType: "WEEKLY",
        recurrenceConfig: { weekdays: [1] }, // every Monday
        startDate: "2026-07-01",
        endDate: null,
      },
      { from: "2026-07-01", count: 3 },
    );

    expect(dates).toEqual(["2026-07-06", "2026-07-13", "2026-07-20"]);
  });

  it("never returns dates before the template's startDate", () => {
    const dates = computeUpcomingOccurrenceDates(
      {
        recurrenceType: "WEEKLY",
        recurrenceConfig: { weekdays: [1] },
        startDate: "2026-07-10",
        endDate: null,
      },
      { from: "2026-07-01", count: 1 },
    );

    expect(dates).toEqual(["2026-07-13"]);
  });

  it("stops at the template's endDate", () => {
    const dates = computeUpcomingOccurrenceDates(
      {
        recurrenceType: "WEEKLY",
        recurrenceConfig: { weekdays: [1] },
        startDate: "2026-07-01",
        endDate: "2026-07-10",
      },
      { from: "2026-07-01", count: 5 },
    );

    expect(dates).toEqual(["2026-07-06"]);
  });
});
