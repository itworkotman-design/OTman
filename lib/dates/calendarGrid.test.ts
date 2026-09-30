import { describe, expect, it } from "vitest";
import { addMonths, buildCalendarDays, monthHasSelectableDay, resolveVisibleMonth, startOfMonth } from "./calendarGrid";

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

describe("monthHasSelectableDay", () => {
  it("returns false when every day of the month is filtered out", () => {
    // September 2026 entirely before an October 1 cutoff.
    const hasDay = monthHasSelectableDay(new Date(2026, 8, 1), (iso) => iso >= "2026-10-01");
    expect(hasDay).toBe(false);
  });

  it("returns true when at least one in-month day passes", () => {
    const hasDay = monthHasSelectableDay(new Date(2026, 9, 1), (iso) => iso >= "2026-10-01");
    expect(hasDay).toBe(true);
  });

  it("ignores leading/trailing days from adjacent months", () => {
    // Aug 31 leads the September grid; only allow that exact day, so the
    // month itself should still report no selectable (in-month) day.
    const hasDay = monthHasSelectableDay(new Date(2026, 8, 1), (iso) => iso === "2026-08-31");
    expect(hasDay).toBe(false);
  });
});

describe("resolveVisibleMonth", () => {
  it("returns the start month unchanged when it already has a selectable day", () => {
    const result = resolveVisibleMonth(new Date(2026, 9, 1), (iso) => iso >= "2026-10-01");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(9);
  });

  it("skips forward to the next month with a selectable day", () => {
    // Opening on Sept 30 with a cutoff of Oct 1 should land on October.
    const result = resolveVisibleMonth(new Date(2026, 8, 30), (iso) => iso >= "2026-10-01");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(9);
  });

  it("skips multiple empty months in a row", () => {
    const result = resolveVisibleMonth(new Date(2026, 5, 1), (iso) => iso >= "2026-09-01");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8);
  });

  it("gives up after the scan limit instead of looping forever", () => {
    const result = resolveVisibleMonth(new Date(2026, 0, 1), () => false, 3);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
  });
});
