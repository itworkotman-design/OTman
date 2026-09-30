import { describe, expect, it } from "vitest";
import { addMonths, buildCalendarDays, startOfMonth } from "./calendarGrid";

describe("startOfMonth", () => {
  it("returns the first day of the given month", () => {
    const result = startOfMonth(new Date(2026, 8, 17));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(1);
  });
});

describe("addMonths", () => {
  it("advances the month and rolls over into the next year", () => {
    const result = addMonths(new Date(2026, 11, 1), 1);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
  });

  it("supports negative counts", () => {
    const result = addMonths(new Date(2026, 0, 1), -1);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11);
  });
});

describe("buildCalendarDays", () => {
  it("returns a 6-week (42 day) grid", () => {
    const days = buildCalendarDays(new Date(2026, 8, 1));
    expect(days).toHaveLength(42);
  });

  it("starts the grid on a Monday", () => {
    const days = buildCalendarDays(new Date(2026, 8, 1));
    const firstDate = new Date(days[0].iso);
    expect((firstDate.getUTCDay() + 6) % 7).toBe(0);
  });

  it("marks days outside the target month as not in current month", () => {
    // September 2026 starts on a Tuesday, so Aug 31 leads the grid.
    const days = buildCalendarDays(new Date(2026, 8, 1));
    expect(days[0].iso).toBe("2026-08-31");
    expect(days[0].inCurrentMonth).toBe(false);
    expect(days[0].dayOfMonth).toBe(31);

    const first = days.find((day) => day.iso === "2026-09-01");
    expect(first?.inCurrentMonth).toBe(true);
    expect(first?.dayOfMonth).toBe(1);
  });

  it("always includes the last day of the target month, marked current", () => {
    const days = buildCalendarDays(new Date(2026, 1, 1)); // Feb 2026, 28 days
    const last = days.find((day) => day.iso === "2026-02-28");
    expect(last?.inCurrentMonth).toBe(true);
  });
});
